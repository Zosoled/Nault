import { HttpClient } from '@angular/common/http'
import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { TranslocoService } from '@jsverse/transloco'
import { Tools } from 'libnemo'
import { BehaviorSubject } from 'rxjs'
import { AddressBookService } from '../../services/address-book.service'
import { WalletService } from '../../services/wallet.service'
import { NotificationService } from '../../services/notification.service'
import { ApiService } from '../../services/api.service'
import { UtilService } from '../../services/util.service'
import { WorkPoolService } from '../../services/work-pool.service'
import { AppSettingsService } from '../../services/app-settings.service'
import { PriceService } from '../../services/price.service'
import { NanoBlockService } from '../../services/nano-block.service'
import { QrModalService } from '../../services/qr-modal.service'
import { environment } from '../../../environments/environment'

@Component({
	selector: 'app-send',
	templateUrl: './send.component.html',
	styleUrls: ['./send.component.css']
})
export class SendComponent implements OnInit {
	nano = 1000000000000000000000000;
	activePanel = 'send';
	sendDestinationType = 'external-address';
	accounts
	addressBookResults$ = new BehaviorSubject([]);
	showAddressBook = false;
	addressBookMatch = '';

	amount = null;
	amountExtraRaw: bigint = 0n
	amountFiat: number | null = null;
	rawAmount: bigint = 0n
	fromAccount: any = {};
	fromAccountID: any = '';
	fromAddressBook = '';
	toAccount: any = false;
	toAccountID = '';
	toOwnAccountID: any = '';
	toAddressBook = '';
	toAccountStatus = null;
	amountStatus = null;
	preparingTransaction = false;
	confirmingTransaction = false;
	selAccountInit = false;

	constructor (
		private route: ActivatedRoute,
		private walletService: WalletService,
		private addressBookService: AddressBookService,
		private notificationService: NotificationService,
		private nodeApi: ApiService,
		private nanoBlock: NanoBlockService,
		public price: PriceService,
		private workPool: WorkPoolService,
		public settings: AppSettingsService,
		private util: UtilService,
		private qrModalService: QrModalService,
		private http: HttpClient,
		private translocoService: TranslocoService) {
		this.accounts = this.walletService.wallet.accounts
	}

	async ngOnInit () {
		const params = this.route.snapshot.queryParams

		this.updateQueries(params)

		this.addressBookService.loadAddressBook()

		// Set default From account
		this.fromAccountID = this.accounts[0]?.id ?? ''

		// Update selected account if changed in the sidebar
		this.walletService.wallet.selectedAccount$.subscribe(async acc => {
			if (this.activePanel !== 'send') {
				// Transaction details already finalized
				return
			}

			if (this.selAccountInit) {
				if (acc) {
					this.fromAccountID = acc.id
				} else {
					this.findFirstAccount()
				}
			}
			this.selAccountInit = true
		})

		// Update the account if query params changes. For example donation button while active on this page
		this.route.queryParams.subscribe(queries => {
			this.updateQueries(queries)
		})

		// Set the account selected in the sidebar as default
		if (this.walletService.wallet.selectedAccount !== null) {
			this.fromAccountID = this.walletService.wallet.selectedAccount.id
		} else {
			// If "total balance" is selected in the sidebar, use the first account in the wallet that has a balance
			this.findFirstAccount()
		}
	}

	updateQueries (params) {
		if (params && params.amount && !isNaN(params.amount)) {
			const amountAsRaw = BigInt(Tools.convert(params.amount, 'mnano', 'raw'))
			this.amountExtraRaw = amountAsRaw % BigInt(this.nano)

			this.amount = Number(Tools.convert(amountAsRaw - this.amountExtraRaw, 'raw', 'mnano'))

			this.syncFiatPrice()
		}

		if (params && params.to) {
			this.toAccountID = params.to
			this.validateDestination()
			this.sendDestinationType = 'external-address'
		}
	}

	async findFirstAccount () {
		// Load balances before we try to find the right account
		if (this.walletService.wallet.balance === 0n) {
			await this.walletService.reloadBalances()
		}

		// Look for the first account that has a balance
		const accountIDWithBalance = this.accounts.reduce((previous, current) => {
			if (previous) return previous
			if (current.balance.gt(0)) return current.id
			return null
		}, null)

		if (accountIDWithBalance) {
			this.fromAccountID = accountIDWithBalance
		}
	}

	// An update to the Nano amount, sync the fiat value
	async syncFiatPrice () {
		console.log(`syncFiatPrice()`)
		console.log(`this.amountFiat: ${this.amount}`)
		console.log(`this.price.price.lastPrice: ${this.price.price.lastPrice}`)
		if (!this.validateAmount() || Number(this.amount) === 0) {
			this.amountFiat = null
			return
		}

		console.log(`sendTransaction() this.amount: ${this.amount}`)
		console.log(typeof this.amount)
		const rawAmount = BigInt(await Tools.convert(this.amount, 'nano', 'raw')) + this.amountExtraRaw
		if (rawAmount < 0n) {
			this.amountFiat = null
			return
		}

		// This is getting hacky, but if their currency is bitcoin, use 6 decimals, if it is not, use 2
		const precision = this.settings.settings.displayCurrency === 'BTC'
			? 1000000
			: 100

		// Determine fiat value of the amount
		const fiatAmount = (parseFloat(Tools.convert(rawAmount, 'raw', 'mnano'))
			* this.price.price.lastPrice).toFixed(3)

		this.amountFiat = Number(fiatAmount)
	}

	// An update to the fiat amount, sync the nano value based on currently selected denomination
	async syncNanoPrice () {
		console.log(`syncNanoPrice()`)
		console.log(`this.amountFiat: ${this.amountFiat}`)
		console.log(`this.price.price.lastPrice: ${this.price.price.lastPrice}`)
		if (!this.amountFiat) {
			this.amount = ''
			return
		}
		if (!this.util.string.isNumeric(this.amountFiat)) return
		const fx = this.amountFiat / this.price.price.lastPrice
		const nanoPrice = await Tools.convert(fx.toString(), 'mnano', 'nano')
		this.amount = fx.toFixed(3)
	}

	async onDestinationAddressInput () {
		this.addressBookMatch = ''

		this.searchAddressBook()

		const destinationAddress = this.toAccountID || ''

		const nanoURIScheme = /^nano:.+$/g
		const isNanoURI = nanoURIScheme.test(destinationAddress)

		if (isNanoURI === true) {
			const url = new URL(destinationAddress)

			if (this.util.account.isValidAccount(url.pathname)) {
				const amountAsRaw = url.searchParams.get('amount')

				const amountAsXNO = (
					amountAsRaw
						? await Tools.convert(amountAsRaw, 'raw', 'nano').toString()
						: null
				)

				setTimeout(
					() => {
						this.updateQueries({
							to: url.pathname,
							amount: amountAsXNO,
						})
					},
					10
				)
			}
		}
	}

	searchAddressBook () {
		this.showAddressBook = true
		const search = this.toAccountID || ''
		const addressBook = this.addressBookService.addressBook

		const matches = addressBook
			.filter(a => a.name.toLowerCase().indexOf(search.toLowerCase()) !== -1)
			.slice(0, 5)

		this.addressBookResults$.next(matches)
	}

	selectBookEntry (account) {
		this.showAddressBook = false
		this.toAccountID = account
		this.searchAddressBook()
		this.validateDestination()
	}

	setSendDestinationType (newType: string) {
		this.sendDestinationType = newType
	}

	async validateDestination () {
		// The timeout is used to solve a bug where the results get hidden too fast and the click is never registered
		setTimeout(() => this.showAddressBook = false, 400)

		// Remove spaces from the account id
		this.toAccountID = this.toAccountID.replace(/ /g, '')

		this.addressBookMatch = (
			this.addressBookService.getAccountName(this.toAccountID)
			|| this.getAccountLabel(this.toAccountID, null)
		)

		if (!this.addressBookMatch && this.toAccountID === environment.donationAddress) {
			this.addressBookMatch = 'Nault Donations'
		}

		// const accountInfo = await this.walletService.walletApi.accountInfo(this.toAccountID);
		this.toAccountStatus = null
		if (this.util.account.isValidAccount(this.toAccountID)) {
			const accountInfo = await this.nodeApi.accountInfo(this.toAccountID)
			if (accountInfo.error) {
				if (accountInfo.error === 'Account not found') {
					this.toAccountStatus = 1
				}
			}
			if (accountInfo && accountInfo.frontier) {
				this.toAccountStatus = 2
			}
		} else {
			this.toAccountStatus = 0
		}
	}

	getAccountLabel (accountID, defaultLabel) {
		const walletAccount = this.walletService.wallet.accounts.find(a => a.id === accountID)

		if (walletAccount == null) {
			return defaultLabel
		}

		return (this.translocoService.translate('general.account') + ' #' + walletAccount.index)
	}

	validateAmount () {
		if (this.util.account.isValidNanoAmount(this.amount)) {
			this.amountStatus = 1
			return true
		} else {
			this.amountStatus = 0
			return false
		}
	}

	getDestinationID () {
		if (this.sendDestinationType === 'external-address') {
			return this.toAccountID
		}

		// 'own-address'
		const walletAccount = this.walletService.wallet.accounts.find(a => a.id === this.toOwnAccountID)

		if (!walletAccount) {
			// Unable to find receiving account in wallet
			return ''
		}

		if (this.toOwnAccountID === this.fromAccountID) {
			// Sending to the same address is only allowed via 'external-address'
			return ''
		}

		return this.toOwnAccountID
	}

	async sendTransaction () {
		const destinationID = this.getDestinationID()
		const isValid = this.util.account.isValidAccount(destinationID)
		if (!isValid) {
			return this.notificationService.sendWarning(`To account address is not valid`)
		}
		if (!this.fromAccountID || !destinationID) {
			return this.notificationService.sendWarning(`From and to account are required`)
		}
		if (!this.validateAmount()) {
			return this.notificationService.sendWarning(`Invalid XNO amount`)
		}

		this.preparingTransaction = true

		const from = await this.nodeApi.accountInfo(this.fromAccountID)
		const to = await this.nodeApi.accountInfo(destinationID)

		this.preparingTransaction = false

		if (!from) {
			return this.notificationService.sendError(`From account not found`)
		}

		const bigBalanceFrom = BigInt(from.balance ?? 0n)
		const bigBalanceTo = BigInt(to.balance ?? 0n)

		this.fromAccount = from
		this.toAccount = to

		const rawAmount = BigInt(await Tools.convert(this.amount, 'nano', 'raw'))
		this.rawAmount = rawAmount + this.amountExtraRaw

		if (this.amount < 0 || rawAmount < 0n) {
			return this.notificationService.sendWarning(`Amount is invalid`)
		}
		if (bigBalanceFrom - rawAmount < 0n) {
			return this.notificationService.sendError(`From account does not have enough XNO`)
		}

		// Determine a proper raw amount to show in the UI, if a decimal was entered
		this.amountExtraRaw = this.rawAmount % BigInt(this.nano)

		// Determine fiat value of the amount
		this.amountFiat = parseFloat(Tools.convert(rawAmount, 'raw', 'mnano')) * this.price.price.lastPrice

		this.fromAddressBook = (
			this.addressBookService.getAccountName(this.fromAccountID)
			|| this.getAccountLabel(this.fromAccountID, 'Account')
		)

		this.toAddressBook = (
			this.addressBookService.getAccountName(destinationID)
			|| this.getAccountLabel(destinationID, null)
		)

		// Start precomputing the work...
		this.workPool.addWorkToCache(this.fromAccount.frontier, 1)

		this.activePanel = 'confirm'
	}

	async confirmTransaction () {
		const wallet = this.walletService.wallet.wallet
		const walletAccount = this.walletService.wallet.accounts.find(a => a.id === this.fromAccountID)
		if (!walletAccount) {
			throw new Error(`Unable to find sending account in wallet`)
		}
		if (this.walletService.isLocked()) {
			const wasUnlocked = await this.walletService.requestWalletUnlock()

			if (wasUnlocked === false) {
				return
			}
		}

		this.confirmingTransaction = true

		try {
			const destinationID = this.getDestinationID()

			const newHash = await this.nanoBlock.generateSend(wallet, walletAccount, destinationID,
				this.rawAmount, this.walletService.isLedgerWallet())

			if (newHash) {
				this.notificationService.removeNotification('success-send')
				this.notificationService.sendSuccess(`Successfully sent ${this.amount} XNO!`, { identifier: 'success-send' })
				this.activePanel = 'send'
				this.amount = null
				this.amountFiat = null
				this.amountExtraRaw = 0n
				this.toAccountID = ''
				this.toOwnAccountID = ''
				this.toAccountStatus = null
				this.fromAddressBook = ''
				this.toAddressBook = ''
				this.addressBookMatch = ''
			} else {
				if (!this.walletService.isLedgerWallet()) {
					this.notificationService.sendError(`There was an error sending your transaction, please try again.`)
				}
			}
		} catch (err) {
			this.notificationService.sendError(`There was an error sending your transaction: ${err.message}`)
		}


		this.confirmingTransaction = false
	}

	async setMaxAmount () {
		const walletAccount = this.walletService.wallet.accounts.find(a => a.id === this.fromAccountID)
		if (!walletAccount) {
			return
		}

		this.amountExtraRaw = walletAccount.balance

		const nanoBalance = Tools.convert(walletAccount.balance, 'raw', 'nano')
		this.amount = parseFloat(nanoBalance).toFixed(6)
		this.syncFiatPrice()
	}

	// open qr reader modal
	openQR (reference, type) {
		const qrResult = this.qrModalService.openQR(reference, type)
		qrResult.then((data) => {
			switch (data.reference) {
				case 'account1':
					this.toAccountID = data.content
					this.validateDestination()
					break
			}
		}, () => { }
		)
	}

	copied () {
		this.notificationService.removeNotification('success-copied')
		this.notificationService.sendSuccess(`Successfully copied to clipboard!`, { identifier: 'success-copied' })
	}

}
