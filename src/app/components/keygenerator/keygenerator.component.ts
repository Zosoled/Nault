import { Component, OnInit } from '@angular/core'
import { NotificationService } from '../../services/notification.service'
import { Wallet } from 'libnemo'

@Component({
	selector: 'app-keygenerator',
	templateUrl: './keygenerator.component.html',
	styleUrls: ['./keygenerator.component.css']
})
export class KeygeneratorComponent implements OnInit {
	seed = '';
	mnemonic = '';
	privateKey = '';
	account = '';
	newWalletMnemonicLines = [];

	constructor (
		private notificationService: NotificationService
	) { }

	ngOnInit (): void {
	}

	async generate () {
		// generate random bytes and create seed/mnemonic
		const wallet = await Wallet.create('BLAKE2b', '')
		await wallet.unlock('')
		this.mnemonic = wallet.mnemonic
		this.seed = wallet.seed
		// derive private/public keys using index 0
		const accounts = await wallet.accounts(0)
		this.privateKey = accounts[0].privateKey
		this.account = accounts[0].address

		// Split the seed up so we can show 4 per line
		const words = this.mnemonic.split(' ')
		const lines = [
			words.slice(0, 4),
			words.slice(4, 8),
			words.slice(8, 12),
			words.slice(12, 16),
			words.slice(16, 20),
			words.slice(20, 24),
		]
		this.newWalletMnemonicLines = lines
	}

	copied () {
		this.notificationService.removeNotification('success-copied')
		this.notificationService.sendSuccess(`Successfully copied to clipboard!`, { identifier: 'success-copied' })
	}
}
