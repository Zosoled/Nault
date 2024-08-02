import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from './notification.service';
import { UtilService } from './util.service';

interface Representative {
  rep_address: string,
  donation_address: string,
  weight: number,
  weight_nano: number,
  delegators: string
  uptime: string,
  synced: number,
  website: string,
  location: string,
  latitude: string,
  longitude: string,
  alias: string,
  username: string,
  score: number,
  version: string,
  protocol: number,
  database: string
}

@Injectable()
export class NinjaService {

  // URL to representative health check API
  // set to empty string to disable
  ninjaUrl = 'https://rpc.nano.to'

  // Backup static JSON list of recommended reps curated by NanoCharts.info
  //ninjaUrl = 'https://nanocharts.info/data/representatives-recommended.json'


  // null - loading, false - offline, true - online
  status = null;

  constructor(private http: HttpClient, private notifications: NotificationService, private util: UtilService) { }

  private randomizeByScore(replist: any) {

    const scores = {};
    const newlist = [];

    for (const account of replist) {
      scores[account.score] = scores[account.score] || [];
      scores[account.score].push(account);
    }

    for (const score in scores) {
      if (scores.hasOwnProperty(score)) {
        let accounts = scores[score];
        accounts = this.util.array.shuffle(accounts);

        for (const account of accounts) {
          newlist.unshift(account);
        }
      }
    }

    return newlist;
  }

  async recommended(): Promise<any> {
    if (this.ninjaUrl === '') {
      return Promise.resolve(null);
    }

    this.http.post(this.ninjaUrl, { action: "reps" } ).subscribe(res => {
      return res;
    })
  }

  async recommendedRandomized(): Promise<any> {
    const replist = await this.recommended();

    if (replist == null) {
      return [];
    }

    return this.randomizeByScore(replist);
  }

  async getSuggestedRep(): Promise<any> {
    const replist = await this.recommendedRandomized();
    return replist[0];
  }

  // Expected to return:
  // false, if the representative never voted as part of nano consensus
  // null, if the representative state is unknown (any other error)
  async getAccount(account: string): Promise<any> {
    if (this.ninjaUrl === '') {
      return Promise.resolve(null);
    }

    const REQUEST_TIMEOUT_MS = 10000;

    // Currently not working if rep is not in rep list of nano.to which is out of date
    // const successPromise =
    //   this.http.post(this.ninjaUrl, { action: "rep_info", account: account }).subscribe(res => {
    //     return res
    //   })

    const successPromise =
      this.http.post(this.ninjaUrl, { action: "account_info", account: account, pending: true, representative: true, weight: true }).subscribe(res => {
        return res
      })

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
