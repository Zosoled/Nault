import { Component, OnInit } from '@angular/core'
import { AppSettingsService } from '../services/app-settings.service'
import { WalletService } from '../services/wallet.service'
import { environment } from '../../environments/environment'

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit {

  donationAccount = environment.donationAddress;
  wallet
  isConfigured

  constructor (private walletService: WalletService, public settingsService: AppSettingsService) {
    this.wallet = this.walletService.wallet
    this.isConfigured = this.walletService.isConfigured
  }

  ngOnInit () {

  }

}
