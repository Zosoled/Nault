import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { UtilService } from './util.service'
import { ApiService } from './api.service'
import { AddressBookService } from './address-book.service'
import { WorkPoolService } from './work-pool.service'
import { WebsocketService } from './websocket.service'
import { NanoBlockService } from './nano-block.service'
import { NotificationService } from './notification.service'
import { AppSettingsService } from './app-settings.service'
import { PriceService } from './price.service'
import { LedgerService } from './ledger.service'
import { Account, Wallet, WalletType } from 'libnemo'

export type WalletKeyType = 'seed' | 'ledger' | 'privateKey' | 'expandedKey'

export interface WalletAccount {
	id: string
	frontier: string | null
	secret: any
	keyPair: any
	index: number
	balance: bigint
	receivable: bigint
	balanceFiat: number
	receivableFiat: number
	addressBookName: string | null
	receivePow: boolean
}

export interface Block {
	account: string
	hash: string
	amount: string
	source: string
}

export interface ReceivableBlockUpdate {
	account: string
	sourceHash: string
	destinationHash: string | null
	hasBeenReceived: boolean
}

export interface FullWallet {
	wallet?: Wallet
	type: WalletKeyType
	balance: bigint
	receivable: bigint
	balanceFiat: number
	receivableFiat: number
	hasReceivable: boolean
	updatingBalance: boolean
	balanceInitialized: boolean
	accounts: Account[]
	selectedAccountId: string | null
	selectedAccount: Account | null
	selectedAccount$: BehaviorSubject<Account | null>
	locked: boolean
	locked$: BehaviorSubject<boolean | false>
	unlockModalRequested$: BehaviorSubject<boolean | false>
	receivableBlocks: Block[]
	receivableBlocksUpdate$: BehaviorSubject<ReceivableBlockUpdate | null>
	newWallet$: BehaviorSubject<boolean | false>
	refresh$: BehaviorSubject<boolean | false>
}
export interface BaseApiAccount {
	account_version: string
	balance: string
	block_count: string
	frontier: string
	modified_timestamp: string
	open_block: string
	receivable: string
	representative: string
	representative_block: string
	weight: string
}

export interface WalletApiAccount extends BaseApiAccount {
	addressBookName?: string | null
	id?: string
	error?: string
}

@Injectable()
export class WalletService {
	nano = 1000000000000000000000000;
	storeKey = `nanovault-wallet`;

	wallet: FullWallet = {
		type: 'seed',
		balance: 0n,
		receivable: 0n,
		balanceFiat: 0,
		receivableFiat: 0,
		hasReceivable: false,
		updatingBalance: false,
		balanceInitialized: false,
		accounts: [],
		selectedAccountId: null,
		selectedAccount: null,
		selectedAccount$: new BehaviorSubject(null),
		locked: false,
		locked$: new BehaviorSubject(false),
		unlockModalRequested$: new BehaviorSubject(false),
		receivableBlocks: [],
		receivableBlocksUpdate$: new BehaviorSubject(null),
		newWallet$: new BehaviorSubject(false),
		refresh$: new BehaviorSubject(false),
	};

	processingReceivable = false;
	successfulBlocks = [];
	trackedHashes = [];

	constructor (
		private util: UtilService,
		private api: ApiService,
		private appSettings: AppSettingsService,
		private addressBook: AddressBookService,
		private price: PriceService,
		private workPool: WorkPoolService,
		private websocket: WebsocketService,
		private nanoBlock: NanoBlockService,
		private ledgerService: LedgerService,
		private notifications: NotificationService) {
		this.websocket.newTransactions$.subscribe(async (transaction) => {
			if (!transaction) return // Not really a new transaction
			console.log('New Transaction', transaction)
			let shouldNotify = false
			if (this.appSettings.settings.minimumReceive) {
				const minAmount = this.util.nano.mnanoToRaw(this.appSettings.settings.minimumReceive)
				if (BigInt(transaction.amount) > BigInt(minAmount)) {
					shouldNotify = true
				}
			} else {
				shouldNotify = true
			}

			const walletAccountIDs = this.wallet.accounts.map(a => a.id)

			const isConfirmedIncomingTransactionForOwnWalletAccount = (
				transaction.block.type === 'state'
				&& transaction.block.subtype === 'send'
				&& walletAccountIDs.includes(transaction.block.link_as_account)
			)

			const isConfirmedSendTransactionFromOwnWalletAccount = (
				transaction.block.type === 'state'
				&& transaction.block.subtype === 'send'
				&& walletAccountIDs.includes(transaction.block.account)
			)

			const isConfirmedReceiveTransactionFromOwnWalletAccount = (
				transaction.block.type === 'state'
				&& transaction.block.subtype === 'receive'
				&& walletAccountIDs.includes(transaction.block.account)
			)

			if (isConfirmedIncomingTransactionForOwnWalletAccount === true) {
				if (shouldNotify === true) {
					if (this.wallet.locked && this.appSettings.settings.receivableOption !== 'manual') {
						this.notifications.sendWarning(`New incoming transaction - Unlock the wallet to receive`, { length: 10000, identifier: 'receivable-locked' })
					} else if (this.appSettings.settings.receivableOption === 'manual') {
						this.notifications.sendWarning(`New incoming transaction - Set to be received manually`, { length: 10000, identifier: 'receivable-locked' })
					}
				} else {
					console.log(
						`Found new incoming block that was below minimum receive amount: `,
						transaction.amount,
						this.appSettings.settings.minimumReceive
					)
				}
				await this.processStateBlock(transaction)
			} else if (isConfirmedSendTransactionFromOwnWalletAccount === true) {
				shouldNotify = true
				await this.processStateBlock(transaction)
			} else if (isConfirmedReceiveTransactionFromOwnWalletAccount === true) {
				shouldNotify = true
			}

			// Find if the source or destination is a tracked address in the address book
			// This is a send transaction (to tracked account or from tracked account)
			if (walletAccountIDs.indexOf(transaction.block.link_as_account) === -1 && transaction.block.type === 'state' &&
				(transaction.block.subtype === 'send' || transaction.block.subtype === 'receive') || transaction.block.subtype === 'change' &&
				(this.addressBook.getTransactionTrackingById(transaction.block.link_as_account) ||
					this.addressBook.getTransactionTrackingById(transaction.block.account))) {
				if (shouldNotify || transaction.block.subtype === 'change') {
					const trackedAmount = this.util.nano.rawToMnano(transaction.amount)
					// Save hash so we can ignore duplicate messages if subscribing to both send and receive
					if (this.trackedHashes.indexOf(transaction.hash) !== -1) return // Already notified this block
					this.trackedHashes.push(transaction.hash)
					const addressLink = transaction.block.link_as_account
					const address = transaction.block.account
					const rep = transaction.block.representative
					const accountHrefLink = `<a href="/account/${addressLink}">${this.addressBook.getAccountName(addressLink)}</a>`
					const accountHref = `<a href="/account/${address}">${this.addressBook.getAccountName(address)}</a>`

					if (transaction.block.subtype === 'send') {
						// Incoming transaction
						if (this.addressBook.getTransactionTrackingById(addressLink)) {
							this.notifications.sendInfo(`Tracked address ${accountHrefLink} can now receive ${trackedAmount} XNO`, { length: 10000 })
							console.log(`Tracked incoming block to: ${address} - Ӿ${trackedAmount}`)
						}
						// Outgoing transaction
						if (this.addressBook.getTransactionTrackingById(address)) {
							this.notifications.sendInfo(`Tracked address ${accountHref} sent ${trackedAmount} XNO`, { length: 10000 })
							console.log(`Tracked send block from: ${address} - Ӿ${trackedAmount}`)
						}
					} else if (transaction.block.subtype === 'receive' && this.addressBook.getTransactionTrackingById(address)) {
						// Receive transaction
						this.notifications.sendInfo(`Tracked address ${accountHref} received incoming ${trackedAmount} XNO`, { length: 10000 })
						console.log(`Tracked receive block to: ${address} - Ӿ${trackedAmount}`)
					} else if (transaction.block.subtype === 'change' && this.addressBook.getTransactionTrackingById(address)) {
						// Change transaction
						this.notifications.sendInfo(`Tracked address ${accountHref} changed its representative to ${rep}`, { length: 10000 })
						console.log(`Tracked change block of: ${address} - Rep: ${rep}`)
					}
				} else {
					console.log(
						`Found new transaction on watch-only account that was below minimum receive amount: `,
						transaction.amount,
						this.appSettings.settings.minimumReceive
					)
				}
			}

			// TODO: We don't really need to call to update balances, we should be able to balance on our own from here
			// I'm not sure about that because what happens if the websocket is disconnected and misses a transaction?
			// won't the balance be incorrect if relying only on the websocket? / Json

			const shouldReloadBalances = (
				shouldNotify
				&& (
					isConfirmedIncomingTransactionForOwnWalletAccount
					|| isConfirmedSendTransactionFromOwnWalletAccount
					|| isConfirmedReceiveTransactionFromOwnWalletAccount
				)
			)

			if (shouldReloadBalances) {
				await this.reloadBalances()
			}
		})

		this.addressBook.addressBook$.subscribe(newAddressBook => {
			this.reloadAddressBook()
		})
	}

	async processStateBlock (transaction) {
		// If we have a minimum receive,  once we know the account... add the amount to wallet receivable? set receivable to true
		if (transaction.block.subtype === 'send' && transaction.block.link_as_account) {
			// This is an incoming send block, we want to perform a receive
			const walletAccount = this.wallet.accounts.find(a => a.id === transaction.block.link_as_account)
			if (!walletAccount) return // Not for our wallet?

			const txAmount = BigInt(transaction.amount)
			let aboveMinimumReceive = true

			if (this.appSettings.settings.minimumReceive) {
				const minAmount = this.util.nano.mnanoToRaw(this.appSettings.settings.minimumReceive)
				aboveMinimumReceive = txAmount > BigInt(minAmount)
			}

			if (aboveMinimumReceive === true) {
				const isNewBlock = this.addReceivableBlock(walletAccount.id, transaction.hash, txAmount, transaction.account)

				if (isNewBlock === true) {
					this.wallet.receivable += txAmount
					this.wallet.receivableFiat += this.util.nano.rawToMnano(txAmount).times(this.price.price.lastPrice).toNumber()
					this.wallet.hasReceivable = true
				}
			}

			await this.processReceivableBlocks()
		} else {
			// Not a send to us, which means it was a block posted by us.  We shouldnt need to do anything...
			const walletAccount = this.wallet.accounts.find(a => a.id === transaction.block.link_as_account)
			if (!walletAccount) return // Not for our wallet?
		}
	}

	reloadAddressBook () {
		this.wallet.accounts.forEach(account => {
			account.addressBookName = this.addressBook.getAccountName(account.id)
		})
	}

	getWalletAccount (accountID) {
		return this.wallet.accounts.find(a => a.id === accountID)
	}


	async patchOldSavedData () {
		// Look for saved accounts using an xrb_ prefix
		const walletData = localStorage.getItem(this.storeKey)
		if (!walletData) return

		const walletJson = JSON.parse(walletData)

		if (walletJson.accounts) {
			const newAccounts = walletJson.accounts.map(account => {
				if (account.id.indexOf('xrb_') !== -1) {
					account.id = account.id.replace('xrb_', 'nano_')
				}
				return account
			})

			walletJson.accounts = newAccounts
		}

		localStorage.setItem(this.storeKey, JSON.stringify(walletJson))

		return
	}

	async loadStoredWallet () {
		this.resetWallet()

		const walletData = localStorage.getItem(this.storeKey)
		if (!walletData) return this.wallet

		const walletJson = JSON.parse(walletData)
		const wallet = await Wallet.restore(walletJson.id)

		if (wallet.type === 'Ledger') {
			wallet.unlock()
		}

		if (walletJson.accounts && walletJson.accounts.length) {
			walletJson.accounts.forEach(account => this.loadWalletAccount(account.index, account.id))
		}

		this.wallet.selectedAccountId = walletJson.selectedAccountId || null

		return this.wallet
	}

	// Using full list of indexes is the latest standard with back compatability with accountsIndex
	async loadImportedWallet (type: WalletType, seed: string, password: string, accountsIndex: number, indexes: Array<number>, walletType: WalletKeyType) {
		this.resetWallet()

		if (type === 'BIP-44' || type === 'BLAKE2b') {
			this.wallet.wallet = await Wallet.load(type, password, seed)
		}
		this.wallet.type = walletType

		if (walletType === 'seed') {
			// Old method
			if (accountsIndex > 0) {
				for (let i = 0; i < accountsIndex; i++) {
					await this.addWalletAccount(i, false)
				}
			} else if (indexes) {
				// New method (the promise ensures all wallets have been added before moving on)
				await Promise.all(indexes.map(async (i) => {
					await this.addWalletAccount(i, false)
				}))
			} else return false
		} else if (walletType === 'privateKey' || walletType === 'expandedKey') {
			this.wallet.accounts.push(this.createSingleKeyAccount(walletType === 'expandedKey'))
		} else { // invalid wallet type
			return false
		}

		await this.reloadBalances()

		if (this.wallet.accounts.length) {
			this.websocket.subscribeAccounts(this.wallet.accounts.map(a => a.id))
		}

		return true
	}

	async generateExportData () {
		const exportData: any = {
			indexes: this.wallet.accounts.map(a => a.index),
		}
		const backup = await Wallet.backup()
		const secret = backup.find(wallet => wallet.id === this.wallet.wallet.id)
		Object.assign(exportData, secret)

		return exportData
	}

	generateExportUrl () {
		const exportData = this.generateExportData()
		const base64Data = Buffer.from(JSON.stringify(exportData)).toString('base64')

		return `https://nault.cc/import-wallet#${base64Data}`
	}

	lockWallet () {
		this.wallet.wallet.lock()

		// Remove secrets from accounts
		this.wallet.accounts.forEach(a => {
			a.keyPair = null
			a.secret = null
		})

		this.wallet.locked = true
		this.wallet.locked$.next(true)

		this.saveWalletExport() // Save so that a refresh gives you a locked wallet

		return true
	}
	async unlockWallet (password: string) {
		try {
			await this.wallet.wallet.unlock(password)
			this.wallet.accounts.forEach(async a => {
				a = await this.wallet.wallet.account(a.index)
			})

			this.wallet.locked = false
			this.wallet.locked$.next(false)

			this.notifications.removeNotification('receivable-locked') // If there is a notification to unlock, remove it

			// Process any receivable blocks
			this.processReceivableBlocks()

			this.saveWalletExport() // Save so a refresh also gives you your unlocked wallet?

			return true
		} catch (err) {
			console.warn(err)
			return false
		}
	}

	async createWalletFromSeed (seed: string) {
		this.resetWallet()

		this.wallet.seed = seed
		this.wallet.seedBytes = this.util.hex.toUint8(seed)

		await this.scanAccounts()
	}

	async scanAccounts () {
		const usedIndices = []

		const NAULT_ACCOUNTS_LIMIT = 20
		const ACCOUNTS_PER_API_REQUEST = 10

		const batchesCount = NAULT_ACCOUNTS_LIMIT / ACCOUNTS_PER_API_REQUEST

		// Getting accounts...
		for (let batchIdx = 0; batchIdx < batchesCount; batchIdx++) {
			const batchAccounts = {}
			const batchAccountsArray = []
			for (let i = 0; i < ACCOUNTS_PER_API_REQUEST; i++) {
				const index = batchIdx * ACCOUNTS_PER_API_REQUEST + i

				let accountAddress = ''
				let accountPublicKey = ''

				if (this.wallet.type === 'seed') {
					const accountBytes = this.util.account.generateAccountSecretKeyBytes(this.wallet.seedBytes, index)
					const accountKeyPair = this.util.account.generateAccountKeyPair(accountBytes)
					accountPublicKey = this.util.uint8.toHex(accountKeyPair.publicKey).toUpperCase()
					accountAddress = Account.load(accountKeyPair.publicKey).address

				} else if (this.wallet.type === 'ledger') {
					const account: any = await this.ledgerService.getLedgerAccount(index)
					accountAddress = account.address.replace('xrb_', 'nano_')
					accountPublicKey = account.publicKey.toUpperCase()

				} else {
					return false
				}

				batchAccounts[accountAddress] = {
					index: index,
					publicKey: accountPublicKey,
				}
				batchAccountsArray.push(accountAddress)
			}

			// Checking frontiers...
			const batchResponse = await this.api.accountsFrontiers(batchAccountsArray)
			if (batchResponse) {
				for (const accountID in batchResponse.frontiers) {
					if (batchResponse.frontiers.hasOwnProperty(accountID)) {
						const frontier = batchResponse.frontiers[accountID]
						const frontierIsValidHash = this.util.nano.isValidHash(frontier)

						if (frontierIsValidHash === true) {
							if (frontier !== batchAccounts[accountID].publicKey) {
								usedIndices.push(batchAccounts[accountID].index)
							}
						}
					}
				}
			}
		}

		// Add accounts
		if (usedIndices.length > 0) {
			for (const index of usedIndices) {
				await this.addWalletAccount(index, false)
			}
		} else {
			await this.addWalletAccount(0, false)
		}

		// Reload balances for all accounts
		this.reloadBalances()
	}

	createNewWallet (seed: string) {
		this.resetWallet()

		this.wallet.seedBytes = this.util.hex.toUint8(seed)
		this.wallet.seed = seed

		this.addWalletAccount()

		return this.wallet.seed
	}

	async createLedgerWallet () {
		// this.resetWallet(); Now done earlier to ensure user not sending to wrong account

		this.wallet.type = 'ledger'

		await this.scanAccounts()

		return this.wallet
	}

	async createWalletFromSingleKey (key: string, expanded: boolean) {
		this.resetWallet()

		this.wallet.type = expanded
			? 'expandedKey'
			: 'privateKey'
		this.wallet.seed = key
		this.wallet.seedBytes = this.util.hex.toUint8(key)

		this.wallet.accounts.push(this.createSingleKeyAccount(expanded))
		await this.reloadBalances()
		this.saveWalletExport()
	}

	async createLedgerAccount (index) {
		const account: any = await this.ledgerService.getLedgerAccount(index)

		const accountID = account.address
		const nanoAccountID = accountID.replace('xrb_', 'nano_')
		const addressBookName = this.addressBook.getAccountName(nanoAccountID)

		const newAccount: WalletAccount = {
			id: nanoAccountID,
			frontier: null,
			secret: null,
			keyPair: null,
			balanceNano: new BigNumber(0),
			receivableNano: new BigNumber(0),
			balance: new BigNumber(0),
			receivable: new BigNumber(0),
			balanceFiat: 0,
			receivableFiat: 0,
			index: index,
			addressBookName,
			receivePow: false,
		}

		return newAccount
	}

	createKeyedAccount (index, accountBytes, accountKeyPair) {
		const accountName = this.util.account.getPublicAccountID(accountKeyPair.publicKey)
		const addressBookName = this.addressBook.getAccountName(accountName)

		const newAccount: WalletAccount = {
			id: accountName,
			frontier: null,
			secret: accountBytes,
			keyPair: accountKeyPair,
			balanceNano: new BigNumber(0),
			receivableNano: new BigNumber(0),
			balance: new BigNumber(0),
			receivable: new BigNumber(0),
			balanceFiat: 0,
			receivableFiat: 0,
			index: index,
			addressBookName,
			receivePow: false,
		}

		return newAccount
	}

	async createSeedAccount (index) {
		const accountBytes = this.util.account.generateAccountSecretKeyBytes(this.wallet.seedBytes, index)
		const accountKeyPair = this.util.account.generateAccountKeyPair(accountBytes)
		return this.createKeyedAccount(index, accountBytes, accountKeyPair)
	}

	createSingleKeyAccount (expanded: boolean) {
		const accountBytes = this.wallet.seedBytes
		const accountKeyPair = this.util.account.generateAccountKeyPair(accountBytes, expanded)
		return this.createKeyedAccount(0, accountBytes, accountKeyPair)
	}

	/**
	 * Reset wallet to a base state, without changing reference to the main object
	 */
	resetWallet () {
		if (this.wallet.accounts.length) {
			this.websocket.unsubscribeAccounts(this.wallet.accounts.map(a => a.id)) // Unsubscribe from old accounts
		}
		this.wallet.type = 'seed'
		this.wallet.password = ''
		this.wallet.locked = false
		this.wallet.locked$.next(false)
		this.wallet.seed = ''
		this.wallet.seedBytes = null
		this.wallet.accounts = []
		this.wallet.balanceNano = new BigNumber(0)
		this.wallet.receivableNano = new BigNumber(0)
		this.wallet.balance = new BigNumber(0)
		this.wallet.receivable = new BigNumber(0)
		this.wallet.balanceFiat = 0
		this.wallet.receivableFiat = 0
		this.wallet.hasReceivable = false
		this.wallet.selectedAccountId = null
		this.wallet.selectedAccount = null
		this.wallet.selectedAccount$.next(null)
		this.wallet.receivableBlocks = []
	}

	isConfigured () {
		switch (this.wallet.type) {
			case 'privateKey':
			case 'expandedKey':
			case 'seed': return !!this.wallet.seed
			case 'ledger': return true
		}
	}

	isLocked () {
		switch (this.wallet.type) {
			case 'privateKey':
			case 'expandedKey':
			case 'seed': return this.wallet.locked
			case 'ledger': return false
		}
	}

	isLedgerWallet () {
		return this.wallet.type === 'ledger'
	}

	isSingleKeyWallet () {
		return (this.wallet.type === 'privateKey' || this.wallet.type === 'expandedKey')
	}

	hasReceivableTransactions () {
		return this.wallet.hasReceivable
		// if (this.appSettings.settings.minimumReceive) {
		//   return this.wallet.hasReceivable;
		// } else {
		//   return this.wallet.receivableRaw.gt(0);
		// }
	}

	reloadFiatBalances () {
		const fiatPrice = this.price.price.lastPrice

		this.wallet.accounts.forEach(account => {
			account.balanceFiat = this.util.nano.rawToMnano(account.balanceNano).times(fiatPrice).toNumber()
			account.receivableFiat = this.util.nano.rawToMnano(account.receivableNano).times(fiatPrice).toNumber()
		})

		this.wallet.balanceFiat = this.util.nano.rawToMnano(this.wallet.balanceNano).times(fiatPrice).toNumber()
		this.wallet.receivableFiat = this.util.nano.rawToMnano(this.wallet.receivableNano).times(fiatPrice).toNumber()
	}

	resetBalances () {
		this.wallet.balanceNano = new BigNumber(0)
		this.wallet.receivableNano = new BigNumber(0)
		this.wallet.balance = new BigNumber(0)
		this.wallet.receivable = new BigNumber(0)
		this.wallet.balanceFiat = 0
		this.wallet.receivableFiat = 0
		this.wallet.hasReceivable = false
	}

	async reloadBalances () {
		// to block two reloads to happen at the same time (websocket)
		if (this.wallet.updatingBalance) return

		this.wallet.updatingBalance = true
		const fiatPrice = this.price.price.lastPrice

		const accountIDs = this.wallet.accounts.map(a => a.id)
		const accounts = await this.api.accountsBalances(accountIDs)
		const frontiers = await this.api.accountsFrontiers(accountIDs)
		// const allFrontiers = [];
		// for (const account in frontiers.frontiers) {
		//   allFrontiers.push({ account, frontier: frontiers.frontiers[account] });
		// }
		// const frontierBlocks = await this.api.blocksInfo(allFrontiers.map(f => f.frontier));

		let walletBalance = new BigNumber(0)
		let walletReceivableInclUnconfirmed = new BigNumber(0)
		let walletReceivableAboveThresholdConfirmed = new BigNumber(0)

		if (!accounts) {
			this.resetBalances()
			this.wallet.updatingBalance = false
			this.wallet.balanceInitialized = true
			return
		}

		this.clearReceivableBlocks()

		for (const accountID in accounts.balances) {
			if (!accounts.balances.hasOwnProperty(accountID)) continue

			const walletAccount = this.wallet.accounts.find(a => a.id === accountID)

			if (!walletAccount) continue

			walletAccount.balanceNano = new BigNumber(accounts.balances[accountID].balance || 0)
			const accountBalanceReceivableInclUnconfirmed = new BigNumber(accounts.balances[accountID].receivable || 0)

			walletAccount.balance = new BigNumber(walletAccount.balanceNano).mod(this.nano)

			walletAccount.balanceFiat = this.util.nano.rawToMnano(walletAccount.balanceNano).times(fiatPrice).toNumber()

			const walletAccountFrontier = frontiers.frontiers?.[accountID]
			const walletAccountFrontierIsValidHash = this.util.nano.isValidHash(walletAccountFrontier)

			walletAccount.frontier = (
				(walletAccountFrontierIsValidHash === true)
					? walletAccountFrontier
					: null
			)

			walletBalance = walletBalance.plus(walletAccount.balanceNano)
			walletReceivableInclUnconfirmed = walletReceivableInclUnconfirmed.plus(accountBalanceReceivableInclUnconfirmed)
		}

		if (walletReceivableInclUnconfirmed.gt(0)) {
			let receivable

			if (this.appSettings.settings.minimumReceive) {
				const minAmount = this.util.nano.mnanoToRaw(this.appSettings.settings.minimumReceive)
				receivable = await this.api.accountsReceivableLimitSorted(this.wallet.accounts.map(a => a.id), minAmount.toString(10))
			} else {
				receivable = await this.api.accountsReceivableSorted(this.wallet.accounts.map(a => a.id))
			}

			if (receivable && receivable.blocks) {
				for (const block in receivable.blocks) {
					if (!receivable.blocks.hasOwnProperty(block)) {
						continue
					}

					const walletAccount = this.wallet.accounts.find(a => a.id === block)

					if (receivable.blocks[block]) {
						let accountReceivable = new BigNumber(0)

						for (const hash in receivable.blocks[block]) {
							if (!receivable.blocks[block].hasOwnProperty(hash)) {
								continue
							}

							const isNewBlock =
								this.addReceivableBlock(
									walletAccount.id,
									hash,
									receivable.blocks[block][hash].amount,
									receivable.blocks[block][hash].source
								)

							if (isNewBlock === true) {
								accountReceivable = accountReceivable.plus(receivable.blocks[block][hash].amount)
								walletReceivableAboveThresholdConfirmed = walletReceivableAboveThresholdConfirmed.plus(receivable.blocks[block][hash].amount)
							}
						}

						walletAccount.receivableNano = accountReceivable
						walletAccount.receivable = accountReceivable.mod(this.nano)
						walletAccount.receivableFiat = this.util.nano.rawToMnano(accountReceivable).times(fiatPrice).toNumber()

						// If there is a receivable, it means we want to add to work cache as receive-threshold
						if (walletAccount.receivableNano.gt(0)) {
							console.log('Adding single receivable account within limit to work cache')
							// Use frontier or public key if open block
							const hash = walletAccount.frontier || new Account(walletAccount.id).publicKey
							// Technically should be 1/64 multiplier here but since we don't know if the receivable will be received before
							// a send or change block is made it's safer to use 1x PoW threshold to be sure the cache will work.
							// On the other hand, it may be more efficient to use 1/64 and simply let the work cache rework
							// in case a send is made instead. The typical user scenario would be to let the wallet auto receive first
							this.workPool.addWorkToCache(hash, 1 / 64)
							walletAccount.receivePow = true
						} else {
							walletAccount.receivePow = false
						}
					} else {
						walletAccount.receivableNano = new BigNumber(0)
						walletAccount.receivable = new BigNumber(0)
						walletAccount.receivableFiat = 0
						walletAccount.receivePow = false
					}
				}
			}
		} else {
			// Not clearing those values to zero earlier to avoid zero values while blocks are being loaded
			for (const accountID in accounts.balances) {
				if (!accounts.balances.hasOwnProperty(accountID)) continue
				const walletAccount = this.wallet.accounts.find(a => a.id === accountID)
				if (!walletAccount) continue
				walletAccount.receivableNano = new BigNumber(0)
				walletAccount.receivable = new BigNumber(0)
				walletAccount.receivableFiat = 0
				walletAccount.receivePow = false
			}
		}

		// Make sure any frontiers are in the work pool
		// If they have no frontier, we want to use their pub key?
		const hashes = this.wallet.accounts.filter(account => (account.receivePow === false)).
			map(account => account.frontier || new Account(account.id).publicKey)
		console.log('Adding non-receivable frontiers to work cache')
		hashes.forEach(hash => this.workPool.addWorkToCache(hash, 1)) // use high pow here since we don't know what tx type will be next

		this.wallet.balanceNano = walletBalance
		this.wallet.receivableNano = walletReceivableAboveThresholdConfirmed

		this.wallet.balance = new BigNumber(walletBalance).mod(this.nano)
		this.wallet.receivable = new BigNumber(walletReceivableAboveThresholdConfirmed).mod(this.nano)

		this.wallet.balanceFiat = this.util.nano.rawToMnano(walletBalance).times(fiatPrice).toNumber()
		this.wallet.receivableFiat = this.util.nano.rawToMnano(walletReceivableAboveThresholdConfirmed).times(fiatPrice).toNumber()

		// eslint-disable-next-line
		this.wallet.hasReceivable = walletReceivableAboveThresholdConfirmed.gt(0)

		this.wallet.updatingBalance = false
		this.wallet.balanceInitialized = true

		if (this.wallet.receivableBlocks.length) {
			await this.processReceivableBlocks()
		}
		this.informBalanceRefresh()
	}

	async loadWalletAccount (accountIndex, accountID) {
		const index = accountIndex
		const addressBookName = this.addressBook.getAccountName(accountID)

		const newAccount: WalletAccount = {
			id: accountID,
			frontier: null,
			secret: null,
			keyPair: null,
			balanceNano: new BigNumber(0),
			receivableNano: new BigNumber(0),
			balance: new BigNumber(0),
			receivable: new BigNumber(0),
			balanceFiat: 0,
			receivableFiat: 0,
			index: index,
			addressBookName,
			receivePow: false,
		}

		this.wallet.accounts.push(newAccount)
		this.websocket.subscribeAccounts([accountID])

		return newAccount
	}

	async addWalletAccount (accountIndex: number | null = null, reloadBalances: boolean = true) {
		// if (!this.wallet.seedBytes) return;
		let index = accountIndex
		if (index === null) {
			index = 0 // Use the existing number, then increment it

			// Make sure the index is not being used (ie. if you delete acct 3/5, then press add twice, it goes 3, 6, 7)
			while (this.wallet.accounts.find(a => a.index === index)) index++
		}

		let newAccount: WalletAccount | null

		if (this.isSingleKeyWallet()) {
			throw new Error(`Wallet consists of a single private key.`)
		} else if (this.wallet.type === 'seed') {
			newAccount = await this.createSeedAccount(index)
		} else if (this.isLedgerWallet()) {
			try {
				newAccount = await this.createLedgerAccount(index)
			} catch (err) {
				// this.notifications.sendWarning(`Unable to load account from ledger.  Make sure it is connected`);
				throw err
			}

		}

		this.wallet.accounts.push(newAccount)

		if (reloadBalances) await this.reloadBalances()

		this.websocket.subscribeAccounts([newAccount.id])

		this.saveWalletExport()

		return newAccount
	}

	async removeWalletAccount (accountID: string) {
		const walletAccount = this.getWalletAccount(accountID)
		if (!walletAccount) throw new Error(`Account is not in wallet`)

		const walletAccountIndex = this.wallet.accounts.findIndex(a => a.id === accountID)
		if (walletAccountIndex === -1) throw new Error(`Account is not in wallet`)

		this.wallet.accounts.splice(walletAccountIndex, 1)

		this.websocket.unsubscribeAccounts([accountID])

		// Reload the balances, save new wallet state
		await this.reloadBalances()
		this.saveWalletExport()

		return true
	}

	async trackAddress (address: string) {
		this.websocket.subscribeAccounts([address])
		console.log('Tracking transactions on ' + address)
	}

	async untrackAddress (address: string) {
		this.websocket.unsubscribeAccounts([address])
		console.log('Stopped tracking transactions on ' + address)
	}

	addReceivableBlock (accountID, blockHash, amount, source) {
		if (this.successfulBlocks.indexOf(blockHash) !== -1) return false // Already successful with this block

		const existingHash = this.wallet.receivableBlocks.find(b => b.hash === blockHash)

		if (existingHash) return false // Already added

		this.wallet.receivableBlocks.push({ account: accountID, hash: blockHash, amount: amount, source: source })
		this.wallet.receivableBlocksUpdate$.next({
			account: accountID,
			sourceHash: blockHash,
			destinationHash: null,
			hasBeenReceived: false,
		})
		this.wallet.receivableBlocksUpdate$.next(null)
		return true
	}

	// Remove a receivable account from the receivable list
	async removeReceivableBlock (blockHash) {
		const index = this.wallet.receivableBlocks.findIndex(b => b.hash === blockHash)
		this.wallet.receivableBlocks.splice(index, 1)
	}

	// Clear the list of receivable blocks
	async clearReceivableBlocks () {
		this.wallet.receivableBlocks.splice(0, this.wallet.receivableBlocks.length)
	}

	sortByAmount (a, b) {
		const x = new BigNumber(a.amount)
		const y = new BigNumber(b.amount)
		return y.comparedTo(x)
	}

	async processReceivableBlocks () {
		if (this.processingReceivable || this.wallet.locked || !this.wallet.receivableBlocks.length || this.appSettings.settings.receivableOption === 'manual') return

		// Sort receivable by amount
		if (this.appSettings.settings.receivableOption === 'amount') {
			this.wallet.receivableBlocks.sort(this.sortByAmount)
		}

		this.processingReceivable = true

		const nextBlock = this.wallet.receivableBlocks[0]
		if (this.successfulBlocks.find(b => b.hash === nextBlock.hash)) {
			return setTimeout(() => this.processReceivableBlocks(), 1500) // Block has already been processed
		}
		const walletAccount = this.getWalletAccount(nextBlock.account)
		if (!walletAccount) {
			this.processingReceivable = false
			return // Dispose of the block, no matching account
		}

		const newHash = await this.nanoBlock.generateReceive(walletAccount, nextBlock.hash, this.isLedgerWallet())
		if (newHash) {
			if (this.successfulBlocks.length >= 15) this.successfulBlocks.shift()
			this.successfulBlocks.push(nextBlock.hash)

			const receiveAmount = this.util.nano.rawToMnano(nextBlock.amount)
			this.notifications.removeNotification('success-receive')
			this.notifications.sendSuccess(`Successfully received ${receiveAmount.decimalPlaces(6, 1).toString()} XNO!`, { identifier: 'success-receive' })

			// remove after processing
			// list also updated with reloadBalances but not if called too fast
			this.removeReceivableBlock(nextBlock.hash)
			await this.reloadBalances()
			this.wallet.receivableBlocksUpdate$.next({
				account: nextBlock.account,
				sourceHash: nextBlock.hash,
				destinationHash: newHash,
				hasBeenReceived: true,
			})
			this.wallet.receivableBlocksUpdate$.next(null)
		} else {
			if (this.isLedgerWallet()) {
				this.processingReceivable = false
				return null // Denied to receive, stop processing
			}
			this.processingReceivable = false
			return this.notifications.sendError(`There was a problem receiving the transaction, try manually!`, { length: 10000 })
		}

		this.processingReceivable = false

		setTimeout(() => this.processReceivableBlocks(), 1500)
	}

	saveWalletExport () {
		const exportData = this.generateWalletExport()

		switch (this.appSettings.settings.walletStore) {
			case 'none':
				this.removeWalletData()
				break
			default:
			case 'localStorage':
				localStorage.setItem(this.storeKey, JSON.stringify(exportData))
				break
		}
	}

	removeWalletData () {
		localStorage.removeItem(this.storeKey)
	}

	generateWalletExport () {
		const data: any = {
			type: this.wallet.type,
			accounts: this.wallet.accounts.map(a => ({ id: a.id, index: a.index })),
			selectedAccountId: this.wallet.selectedAccount?.id ?? null,
		}

		if (this.wallet.type === 'ledger') {
		} else {
			// Forcefully encrypt the seed so an unlocked wallet is never saved
			if (!this.wallet.locked) {
				const encryptedSeed = CryptoJS.AES.encrypt(this.wallet.seed, this.wallet.password || '')
				data.seed = encryptedSeed.toString()
			} else {
				data.seed = this.wallet.seed
			}
			data.locked = true
		}

		return data
	}

	// Run an accountInfo call for each account in the wallet to get their representatives
	async getAccountsDetails (): Promise<WalletApiAccount[]> {
		return await Promise.all(
			this.wallet.accounts.map(account =>
				this.api.accountInfo(account.id)
					.then(res => {
						try {
							const ret = {
								...res,
								id: account.id,
								addressBookName: account.addressBookName
							}
							return ret
						} catch {
							return null
						}
					})
			)
		)
	}

	// Subscribable event when a new wallet is created
	informNewWallet () {
		this.wallet.newWallet$.next(true)
		this.wallet.newWallet$.next(false)
	}

	// Subscribable event when balances has been refreshed
	informBalanceRefresh () {
		this.wallet.refresh$.next(true)
		this.wallet.refresh$.next(false)
	}

	requestWalletUnlock () {
		this.wallet.unlockModalRequested$.next(true)

		return new Promise(
			(resolve, reject) => {
				let subscriptionForUnlock
				let subscriptionForCancel

				const removeSubscriptions = () => {
					if (subscriptionForUnlock != null) {
						subscriptionForUnlock.unsubscribe()
					}

					if (subscriptionForCancel != null) {
						subscriptionForCancel.unsubscribe()
					}
				}

				subscriptionForUnlock =
					this.wallet.locked$.subscribe(async isLocked => {
						if (isLocked === false) {
							removeSubscriptions()

							const wasUnlocked = true
							resolve(wasUnlocked)
						}
					})

				subscriptionForCancel =
					this.wallet.unlockModalRequested$.subscribe(async wasRequested => {
						if (wasRequested === false) {
							removeSubscriptions()

							const wasUnlocked = false
							resolve(wasUnlocked)
						}
					})
			}
		)
	}
}
