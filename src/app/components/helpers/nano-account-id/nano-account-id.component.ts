import {Component, Input, OnChanges, HostBinding} from '@angular/core';

@Component({
  selector: 'app-nano-account-id',
  templateUrl: './nano-account-id.component.html',
  styleUrls: ['./nano-account-id.component.css'],
})
export class NanoAccountIdComponent implements OnChanges {

  @HostBinding('class') classes: string;
  @Input() accountID: string;
  @Input() middle: 'on'|'off'|'auto'|'break' = 'auto';

  prefix = 'nano_';
  firstCharacters = '';
  middleCharacters = '';
  lastCharacters = '';
  openingChars = 10;
  closingChars = 5;

  constructor() { }

  ngOnChanges() {
    this.firstCharacters = this.accountID?.slice(0, this.openingChars).replace('nano_', '');
    this.lastCharacters = this.accountID?.slice(-this.closingChars);
    this.setMiddle();

    if (this.middle === 'auto') this.classes = 'uk-flex';
    if (this.middle === 'break') this.classes = 'nano-address-breakable';
  }

  middleOn () {
    if (this.middle = 'off') {
      this.middle = 'on';
      this.setMiddle();
    }
  }

  private setMiddle () {
    if (this.middle === 'off') {
      this.middleCharacters = '...'
    } else {
      this.middleCharacters = this.accountID?.slice(this.openingChars, -this.closingChars)
    }
  }
}
