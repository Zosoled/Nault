import { Injectable } from '@angular/core';
import {AppSettingsService} from './app-settings.service';
import {ApiService} from './api.service';
import {NotificationService} from './notification.service';
import { NanoPow } from 'nano-pow';
import {UtilService} from './util.service';
import {BehaviorSubject} from 'rxjs';

type DeferredPromise = {
  promise: Promise<any>;
  resolve: any;
  reject: any;
};
type PowQueueItem = {
  hash: string,
  work?: string,
  promise: DeferredPromise,
  multiplier: number,
};
const mod = window['Module'];
export const baseThreshold = 'fffffff800000000'; // threshold since v21 epoch update
const hardwareConcurrency = window.navigator.hardwareConcurrency || 2;
const workerCount = Math.max(hardwareConcurrency - 1, 1);
export enum workState {'success', 'cancelled', 'error'}

@Injectable()
export class PowService {
  powAlertLimit = 60; // alert long pow after X sec
  PoWPool = [];
  parallelQueue = false;
  processingQueueItem = false;
  currentProcessTime = 0; // start timestamp for PoW
  powAlert$: BehaviorSubject<boolean|false> = new BehaviorSubject(false);
  public shouldContinueQueue = true; // set to false to disable further processing
  shouldAbortGpuPow = false; // set to true to abort GPU pow

  constructor(
    private appSettings: AppSettingsService,
    private api: ApiService,
    private notifications: NotificationService,
    private util: UtilService
  ) { }

  /**
   * Get PoW for a hash.  If it's already being processed, return the promise.
   * Otherwise, add it into the queue and return when it is ready
   */
  async getPow(hash: string, multiplier: number) {
    const existingPoW = this.PoWPool.find(p => p.hash === hash);
    if (existingPoW) {
      return existingPoW.promise.promise; // Its okay if its resolved already
    }
    return this.addQueueItem(hash, multiplier);
  }

  /**
   * Add a new hash into the queue to perform work on.
   * Returns a promise that is resolved when work is completed
   */
  addQueueItem(hash, multiplier) {
    const existingPoW = this.PoWPool.find(p => p.hash === hash);
    if (existingPoW) {
      return existingPoW.promise.promise;
    }
    const queueItem: PowQueueItem = {
      hash,
      work: null,
      promise: this.getDeferredPromise(),
      multiplier: multiplier,
    };
    this.PoWPool.push(queueItem);
    this.processQueue();
    return queueItem.promise.promise;
  }

  /**
   * Gets the next item in the queue and sends it to be processed
   */
  private processQueue() {
    if (!this.PoWPool.length) return; // No items in the queue
    if (this.parallelQueue) return; // Not yet implemented
    if (this.processingQueueItem) return; // Already processing.
    // Get the next item from the queue and process it
    this.processNextQueueItem();
  }

  /**
   * Process an individual hash from the queue
   * Uses the latest app settings to determine which type of PoW to use
   */
  private async processNextQueueItem() {
    if (!this.PoWPool.length) return; // Nothing in the queue?
    this.processingQueueItem = true;
    const queueItem = this.PoWPool[0];
    this.powAlert$.next(false); // extra safety to ensure the alert is always reset

    let powSource = this.appSettings.settings.powSource;
    const multiplierSource: number = this.appSettings.settings.multiplierSource;
    let localMultiplier: number = 1;

    if (powSource === 'client' || powSource === 'custom') {
      if (multiplierSource > 1) { // use manual difficulty
        localMultiplier = multiplierSource;
      } else { // use default requested difficulty
        localMultiplier = queueItem.multiplier;
      }
    }

    const result = {state: null, work: ''};
    let workServer, multiplier
    switch (powSource) {
      // generate work locally
      case 'client': {
        try {
          result.work = await this.getPowFromClient(queueItem.hash, localMultiplier);
          result.state = workState.success;
        } catch (state) {
          result.state = state;
        }
        break;
      }
      // generate work remotely after setting up server settings and falling through to default case
      case 'server': {
        workServer ??= '';
        multiplier ??= queueItem.multiplier;
      }
      case 'custom': {
        workServer ??= this.appSettings.settings.customWorkServer;
        // Check all known APIs and return true if there is no match. Then allow local PoW mutliplier
        multiplier ??= this.appSettings.knownApiEndpoints.every(endpointUrl => !workServer.includes(endpointUrl))
          ? localMultiplier
          : queueItem.multiplier;
      }
      default: {
        const work = await this.getPowFromServer(queueItem.hash, multiplier, workServer);
        if (work) {
          result.work = work;
          result.state = workState.success;
        } else {
          result.state = workState.error;
        }
        break;
      }
    }

    this.currentProcessTime = 0; // Reset timer
    this.PoWPool.shift(); // Remove this item from the queue
    this.processingQueueItem = false;

    if (result.state === workState.success) {
      queueItem.work = result.work;
      queueItem.promise.resolve(result);
    } else {
      // this.notifications.sendError(`Unable to generate work for ${queueItem.hash} using ${powSource}`);
      queueItem.promise.reject(result);
    }

    if (this.shouldContinueQueue) {
      this.processQueue();
    }

    return queueItem;
  }

  /**
   * Actual PoW functions
   */
  async getPowFromServer(hash, multiplier, workServer = '') {
    const newThreshold = this.util.nano.difficultyFromMultiplier(multiplier, baseThreshold);
    const serverString = workServer === '' ? 'external' : 'custom';
    console.log('Generating work with multiplier ' + multiplier + ' at threshold ' +
      newThreshold + ' using ' + serverString + ' server for hash: ', hash);
    return await this.api.workGenerate(hash, newThreshold, workServer)
      .then(result => result.work)
      .catch(async err => {
        console.warn('Error getting work from server, falling back to client...')
        return await this.getPowFromClient(hash, multiplier)
      });
  }

  /**
   * Generate proof-of-work using NanoPow
   */
  async getPowFromClient(blockhash, multiplier) {
    this.checkPowProcessLength(); // start alert timer
    const newThreshold = this.util.nano.difficultyFromMultiplier(multiplier, baseThreshold);
    console.log(`NanoPow: Generating work with multiplier ${multiplier} at threshold ${newThreshold} for hash: ${blockhash}`);

    const response = this.getDeferredPromise();

    const timeout = setInterval(() => {
      if (this.shouldAbortGpuPow) {
        clearInterval(timeout);
        this.shouldAbortGpuPow = false;
        response.reject(workState.cancelled);
        return true;
      }
    }, 1000);

    try {
      const start = performance.now();
      const result = await NanoPow.work_generate(blockhash, { difficulty: newThreshold, effort: workerCount })
      if ('error' in result) {
        throw new Error(result.error);
      }
      const { hash, work, difficulty } = result;
      console.log(`NanoPow: Found work (${work}) for ${hash} after ${((performance.now() - start) / 1000).toPrecision(3)} seconds`);
      response.resolve(work);
    } catch (error) {
      console.warn(error.message);
      response.reject(workState.error);
    } finally {
      clearInterval(timeout)
    }

    return response.promise;
  }

  // Helper for returning a deferred promise that we can resolve when work is ready
  private getDeferredPromise (): DeferredPromise {
    const defer = {
      promise: null,
      resolve: null,
      reject: null,
    };

    defer.promise = new Promise((resolve, reject) => {
      defer.resolve = resolve;
      defer.reject = reject;
    });

    return defer;
  }

  // Check if pow takes longer than limit, then notify user
  async checkPowProcessLength () {
    this.shouldAbortGpuPow = false;
    this.currentProcessTime = performance.now();
    while (this.currentProcessTime !== 0) {
      // display alert of PoW has been running more than X ms
      if (performance.now() - this.currentProcessTime >= this.powAlertLimit * 1000) {
        this.powAlert$.next(true);
      }
      await this.sleep(1000);
    }
    this.powAlert$.next(false);
  }

  sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Interupt running pow and empty the queue
  public cancelAllPow (notify) {
    if (this.currentProcessTime !== 0) {
      this.currentProcessTime = 0; // reset timer
      this.powAlert$.next(false); // announce alert to close
      this.shouldContinueQueue = false; // disable further processing
      this.shouldAbortGpuPow = true; // abort GPU pow if running
      if (notify) {
        this.notifications.sendInfo(`Proof of Work generation cancelled by the user`);
      }
      return true;
    }
    return false;
  }
}
