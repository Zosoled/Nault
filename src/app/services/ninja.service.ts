import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from './notification.service';
import { UtilService } from './util.service';

@Injectable()
export class NinjaService {

  // URL to representative health check API
  // set to empty string to disable
  ninjaUrl = 'https://node.somenano.com/proxy'

  // null - loading, false - offline, true - online
  status = null;

  constructor(private http: HttpClient, private notifications: NotificationService, private util: UtilService) { }

  private randomizeByScore(replist: any) {

  }

  async recommended(): Promise<any> {
    if (this.ninjaUrl === '') {
      return Promise.resolve(null);
    }
    this.http.post(this.ninjaUrl, { action: 'representatives_online' } ).subscribe(res => {
      return res;
    })
  }

  async recommendedRandomized(): Promise<any> {
    const onlineReps = await this.recommended();
    if (onlineReps == null) {
      return [];
    }

    const scores = {};
    const shuffledReps = [];

    for (const onlineRep of onlineReps) {
      scores[onlineRep.score] = scores[onlineRep.score] || [];
      scores[onlineRep.score].push(onlineRep);
    }

    for (const score in scores) {
      if (scores.hasOwnProperty(score)) {
        let accounts = scores[score];
        accounts = this.util.array.shuffle(accounts);

        for (const account of accounts) {
          shuffledReps.unshift(account);
        }
      }
    }

    return shuffledReps;
  }

  async getSuggestedRep(): Promise<any> {
    const randomReps = await this.recommendedRandomized();
    return randomReps[0];
  }

  // Expected to return:
  // false, if the representative never voted as part of nano consensus
  // null, if the representative state is unknown (any other error)
  async getAccount(account: string): Promise<any> {
    if (this.ninjaUrl === '') {
      return Promise.resolve(null);
    }

    const REQUEST_TIMEOUT_MS = 10000;

    const options = {
      action: "account_info",
      account: account,
      receivable: true,
      representative: true,
      weight: true
    }
    const successPromise =
      this.http.post(this.ninjaUrl, options).subscribe(res => {
        return res;
      });

    const timeoutPromise =
      new Promise(resolve => {
        setTimeout(
          () => {
            resolve(null);
          },
          REQUEST_TIMEOUT_MS
        );
      });

    return await Promise.race([
      successPromise,
      timeoutPromise
    ]);
  }
}
