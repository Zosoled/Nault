import { Injectable } from '@angular/core'
import { Account, Blake2b, Tools } from 'libnemo'
import NanoPow from 'nano-pow'

const nacl = window['nacl']
const STATE_BLOCK_PREAMBLE = '0000000000000000000000000000000000000000000000000000000000000006'
const pbkdf2_1 = require('pbkdf2')

export interface StateBlock {
	account: string
	previous: string
	representative: string
	balance: string
	link: string
	signature: string
	work: string
}

export enum TxType { 'send', 'receive', 'open', 'change' }

@Injectable()
export class UtilService {

	constructor () {
	}

	hex = {
		toUint4: hexToUint4,
		fromUint8: uint8ToHex,
		toUint8: hexToUint8,
		isHex: isHex,
	};
	uint4 = {
		toUint5: uint4ToUint5,
		toUint8: uint4ToUint8,
	};
	uint5 = {
		toString: uint5ToString,
	};
	uint8 = {
		toUint4: uint8ToUint4,
		fromHex: hexToUint8,
		toHex: uint8ToHex,
	};
	dec = {
		toHex: decToHex,
	};
	string = {
		isNumeric: isNumeric,
		mnemonicToSeedSync: mnemonicToSeedSync,
	};
	account = {
		generateAccountSecretKeyBytes: generateAccountSecretKeyBytes,
		generateAccountKeyPair: generateAccountKeyPair,
		getAccountChecksum: getAccountChecksum,
		setPrefix: setPrefix,
		isValidAccount: isValidAccount,
		isValidNanoAmount: isValidNanoAmount,
		isValidAmount: isValidAmount,
	};
	nano = {
		mnanoToRaw: mnanoToRaw,
		knanoToRaw: knanoToRaw,
		nanoToRaw: nanoToRaw,
		rawToMnano: rawToMnano,
		rawToKnano: rawToKnano,
		rawToNano: rawToNano,
		hashStateBlock: hashStateBlock,
		isValidSeed: isValidSeed,
		isValidHash: isValidHash,
		isValidIndex: isValidIndex,
		isValidSignature: isValidSignature,
		isValidWork: isValidWork,
		validateWork: validateWork,
		difficultyFromMultiplier: difficultyFromMultiplier,
		multiplierFromDifficulty: multiplierFromDifficulty,
	};
	array = {
		shuffle: shuffle,
		findWithAttr: findWithAttr,
		equalArrays: equalArrays
	};

}



/** Hex Functions **/
function hexToUint4 (hexValue) {
	const uint4 = new Uint8Array(hexValue.length)
	for (let i = 0; i < hexValue.length; i++) uint4[i] = parseInt(hexValue.substr(i, 1), 16)

	return uint4
}
function hexToUint8 (hexValue) {
	// eslint-disable-next-line no-bitwise
	const length = (hexValue.length / 2) | 0
	const uint8 = new Uint8Array(length)
	for (let i = 0; i < length; i++) uint8[i] = parseInt(hexValue.substr(i * 2, 2), 16)

	return uint8
}

// Check if string is hexdecimal
function isHex (h) {
	const re = /^[0-9a-fA-F]+$/
	return re.test(h)
}


/** Uint4 Functions **/
function uint4ToUint8 (uintValue) {
	const length = uintValue.length / 2
	const uint8 = new Uint8Array(length)
	for (let i = 0; i < length; i++)	uint8[i] = uintValue[i * 2] * 16 + uintValue[i * 2 + 1]

	return uint8
}

/* eslint-disable no-bitwise */
function uint4ToUint5 (uintValue) {
	const length = uintValue.length / 5 * 4
	const uint5 = new Uint8Array(length)
	for (let i = 1; i <= length; i++) {
		const n = i - 1
		const m = i % 4
		const z = n + ((i - m) / 4)
		const right = uintValue[z] << m
		let left
		if (((length - i) % 4) === 0) left = uintValue[z - 1] << 4
		else left = uintValue[z + 1] >> (4 - m)
		uint5[n] = (left + right) % 32
	}
	return uint5
}
/* eslint-enable no-bitwise */

function uint4ToHex (uint4) {
	let hex = ''
	for (let i = 0; i < uint4.length; i++) hex += uint4[i].toString(16).toUpperCase()
	return hex
}


/** Uint5 Functions **/
function uint5ToString (uint5) {
	const letter_list = '13456789abcdefghijkmnopqrstuwxyz'.split('')
	let string = ''
	for (let i = 0; i < uint5.length; i++)	string += letter_list[uint5[i]]

	return string
}

/* eslint-disable no-bitwise */
function uint5ToUint4 (uint5) {
	const length = uint5.length / 4 * 5
	const uint4 = new Uint8Array(length)
	for (let i = 1; i <= length; i++) {
		const n = i - 1
		const m = i % 5
		const z = n - ((i - m) / 5)
		const right = uint5[z - 1] << (5 - m)
		const left = uint5[z] >> m
		uint4[n] = (left + right) % 16
	}
	return uint4
}
/* eslint-enable no-bitwise */


/** Uint8 Functions **/
function uint8ToHex (uintValue) {
	let hex = ''
	let aux
	for (let i = 0; i < uintValue.length; i++) {
		aux = uintValue[i].toString(16).toUpperCase()
		if (aux.length === 1) {
			aux = '0' + aux
		}
		hex += aux
		aux = ''
	}

	return (hex)
}

/* eslint-disable no-bitwise */
function uint8ToUint4 (uintValue) {
	const uint4 = new Uint8Array(uintValue.length * 2)
	for (let i = 0; i < uintValue.length; i++) {
		uint4[i * 2] = uintValue[i] / 16 | 0
		uint4[i * 2 + 1] = uintValue[i] % 16
	}

	return uint4
}
/* eslint-enable no-bitwise */


/** Dec Functions **/
function decToHex (decValue, bytes = null) {
	// eslint-disable-next-line prefer-const
	let dec = decValue.toString().split(''), sum = [], hex = '', hexArray = [], i, s
	while (dec.length) {
		s = 1 * dec.shift()
		for (i = 0; s || i < sum.length; i++) {
			s += (sum[i] || 0) * 10
			sum[i] = s % 16
			s = (s - sum[i]) / 16
		}
	}
	while (sum.length) {
		hexArray.push(sum.pop().toString(16))
	}

	hex = hexArray.join('')

	if (hex.length % 2 !== 0) {
		hex = '0' + hex
	}

	if (bytes > hex.length / 2) {
		const diff = bytes - hex.length / 2
		for (let j = 0; j < diff; j++) {
			hex = '00' + hex
		}
	}

	return hex
}

/** String Functions **/
function stringToUint5 (string) {
	const letter_list = '13456789abcdefghijkmnopqrstuwxyz'.split('')
	const length = string.length
	const string_array = string.split('')
	const uint5 = new Uint8Array(length)
	for (let i = 0; i < length; i++)	uint5[i] = letter_list.indexOf(string_array[i])
	return uint5
}

function isNumeric (val) {
	// numerics and last character is not a dot and number of dots is 0 or 1
	const isnum = /^-?\d*\.?\d*$/.test(val) && val !== ''
	return isnum && String(val).slice(-1) !== '.'
}

function mnemonicToSeedSync (mnemonic, password = null) {
	// const mnemonicBuffer = Buffer.from((mnemonic || '').normalize('NFKD'), 'utf8');
	// const saltBuffer = Buffer.from(this.salt((password || '').normalize('NFKD')), 'utf8');
	// Using textencoder here instead ensures it returns an Uint8Array when using the desktop app
	// and not a Buffer object that messes up the bip39 seed
	const enc = new TextEncoder()
	const mnemonicBuffer = enc.encode(mnemonic)
	const saltBuffer = enc.encode('mnemonic' + (password || ''))
	return pbkdf2_1.pbkdf2Sync(mnemonicBuffer, saltBuffer, 2048, 64, 'sha512')
}


/** Account Functions **/
function generateAccountSecretKeyBytes (seedBytes, accountIndex) {
	const accountBytes = hexToUint8(decToHex(accountIndex, 4))
	const newKey = new Blake2b(32).update(seedBytes).update(accountBytes).digest()
	return newKey
}

function getAccountChecksum (pubkey) {
	const out = new Blake2b(5).update(pubkey).digest()
	return out.reverse()
}

function generateAccountKeyPair (accountSecretKeyBytes, expanded = false) {
	return nacl.sign.keyPair.fromSecretKey(accountSecretKeyBytes, expanded)
}

function isValidAccount (account: string): boolean {
	try {
		Account.validate(account)
		return true
	} catch (err) {
		return false
	}
}

// Check if a string is a numeric and larger than 0 but less than nano supply
function isValidNanoAmount (val: string) {
	// numerics and last character is not a dot and number of dots is 0 or 1
	const isnum = /^-?\d*\.?\d*$/.test(val)
	if (isnum && String(val).slice(-1) !== '.') {
		if (val !== '' && isValidAmount(val)) {
			return true
		} else {
			return false
		}
	} else {
		return false
	}
}

// Check if valid raw amount
function isValidAmount (val: string) {
	return BigInt(val) > 0n && BigInt(val) < 0xffffffffffffffffffffffffffffffffn
}

function setPrefix (account, prefix = 'xrb') {
	if (prefix === 'nano') {
		return account.replace('xrb_', 'nano_')
	} else {
		return account.replace('nano_', 'xrb_')
	}
}

/**
 * Conversion functions
 */
const mnano = 1000000000000000000000000000000
const knano = 1000000000000000000000000000
const nano = 1000000000000000000000000
function mnanoToRaw (value) {
	return Tools.convert(value, 'mnano', 'raw')
}
function knanoToRaw (value) {
	return Tools.convert(value, 'knano', 'raw')
}
function nanoToRaw (value) {
	return Tools.convert(value, 'nano', 'raw')
}
function rawToMnano (value) {
	return Tools.convert(value, 'raw', 'mnano')
}
function rawToKnano (value) {
	return Tools.convert(value, 'raw', 'knano')
}
function rawToNano (value) {
	return Tools.convert(value, 'raw', 'nano')
}

/**
 * Nano functions
 */
function isValidSeed (val: string) {
	return /^[A-F0-9]{64}$/i.test(val)
}

function isValidHash (val: string) {
	return /^[A-F0-9]{64}$/i.test(val)
}

function isValidIndex (val: number) {
	return val > 0 && val < 2 ** 32 - 1
}

function isValidSignature (val: string) {
	return /^[A-F0-9]{128}$/i.test(val)
}

function isValidWork (val: string) {
	return /^[A-F0-9]{16}$/i.test(val)
}

function validateWork (blockHash: string, threshold: string, work: string) {
	return NanoPow.work_validate(work, blockHash, { difficulty: threshold })
}

function hashStateBlock (block: StateBlock) {
	const balance = BigInt(block.balance)
	if (balance < 0n) {
		throw new Error(`Negative balance`)
	}
	let balancePadded = balance.toString(16)
	while (balancePadded.length < 32) balancePadded = '0' + balancePadded // Left pad with 0's
	return new Blake2b(32)
		.update(hexToUint8(STATE_BLOCK_PREAMBLE))
		.update(hexToUint8(Account.load(block.account).publicKey))
		.update(hexToUint8(block.previous))
		.update(hexToUint8(Account.load(block.representative).publicKey))
		.update(hexToUint8(balancePadded))
		.update(hexToUint8(block.link))
		.digest()
}

// Determine new difficulty from base difficulty (hexadecimal string) and a multiplier (float). Returns hex string
export function difficultyFromMultiplier (multiplier, base_difficulty) {
	const big64 = 2n ** 64n
	const big_multiplier = BigInt(multiplier)
	const big_base = BigInt(`0x${base_difficulty}`)
	const result = big64 - ((big64 - big_base) / big_multiplier)
	return result.toString(16)
}

// Determine new multiplier from base difficulty (hexadecimal string) and target difficulty (hexadecimal string). Returns Number
export function multiplierFromDifficulty (difficulty, base_difficulty) {
	const big64 = 2n ** 64n
	const big_diff = BigInt(`0x${difficulty}`)
	const big_base = BigInt(`0x${base_difficulty}`)
	return Number(big64 - big_base) / Number(big64 - big_diff)
}

// shuffle any array
function shuffle (array) {
	let currentIndex = array.length, temporaryValue, randomIndex

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {

		// Pick a remaining element...
		randomIndex = Math.floor(Math.random() * currentIndex)
		currentIndex -= 1

		// And swap it with the current element.
		temporaryValue = array[currentIndex]
		array[currentIndex] = array[randomIndex]
		array[randomIndex] = temporaryValue
	}

	return array
}

function equalArrays (array1, array2) {
	if (array1.length !== array2.length) {
		return false
	}
	for (let i = 0; i < array1.length; i++) {
		if (array1[i] !== array2[i]) return false
	}
	return true
}

// find the position in an array given an attribute and value
function findWithAttr (array, attr, value) {
	for (let i = 0; i < array.length; i += 1) {
		if (array[i][attr] === value) {
			return i
		}
	}
	return -1
}

const util = {
	hex: {
		toUint4: hexToUint4,
		fromUint8: uint8ToHex,
		toUint8: hexToUint8,
		isHex: isHex,
	},
	uint4: {
		toUint5: uint4ToUint5,
		toUint8: uint4ToUint8,
	},
	uint5: {
		toString: uint5ToString,
	},
	uint8: {
		toUint4: uint8ToUint4,
		fromHex: hexToUint8,
		toHex: uint8ToHex,
	},
	dec: {
		toHex: decToHex,
	},
	string: {
		isNumeric: isNumeric,
		mnemonicToSeedSync: mnemonicToSeedSync,
	},
	account: {
		generateAccountSecretKeyBytes: generateAccountSecretKeyBytes,
		generateAccountKeyPair: generateAccountKeyPair,
		getAccountChecksum: getAccountChecksum,
		setPrefix: setPrefix,
		isValidAccount: isValidAccount,
		isValidNanoAmount: isValidNanoAmount,
		isValidAmount: isValidNanoAmount,
	},
	nano: {
		mnanoToRaw: mnanoToRaw,
		knanoToRaw: knanoToRaw,
		nanoToRaw: nanoToRaw,
		rawToMnano: rawToMnano,
		rawToKnano: rawToKnano,
		rawToNano: rawToNano,
		hashStateBlock: hashStateBlock,
		isValidSeed: isValidSeed,
		isValidHash: isValidHash,
		isValidIndex: isValidIndex,
		isValidSignature: isValidSignature,
		isValidWork: isValidWork,
		validateWork: validateWork,
		difficultyFromMultiplier: difficultyFromMultiplier,
		multiplierFromDifficulty: multiplierFromDifficulty,
	},
	array: {
		shuffle: shuffle,
		findWithAttr: findWithAttr,
		equalArrays: equalArrays
	}
}
