import { crc16BytesBe } from './utils/checksum'
import {
    uint8toInt8,
    int8ToUint8,
    bytesToBase64,
    base64ToBytes,
    hexToBytes,
    bytesToHex,
    bytesCompare
} from './utils/helpers'

const FLAG_BOUNCEABLE = 0x11
const FLAG_NON_BOUNCEABLE = 0x51
const FLAG_TEST_ONLY = 0x80

export type AddressType = 'base64' | 'raw'

interface AddressTag {
    bounceable: boolean
    testOnly: boolean
}

interface AddressData extends AddressTag {
    workchain: number
    hash: Uint8Array
}

interface AddressOptions {
    urlSafe?: boolean
    workchain?: number
    bounceable?: boolean
    testOnly?: boolean
}

/**
 * Smart contract address
 *
 * @class Address
 */
class Address {
    private readonly _hash: Uint8Array

    private readonly _workchain: number

    private readonly _bounceable: boolean

    private readonly _testOnly: boolean

    /**
     * Creates an instance of {@link Address}
     *
     * Next formats can be used as constructor argument:
     * - Raw
     * - Base64
     * - Address
     *
     * @param {(string | Address | Uint8Array)} address
     *
     * @example
     * ```ts
     * import { Address } from '@tonstack/tontools'
     *
     * const bytes = new Uint8Array() // containing workchain and address hash bytes
     * const address = new Address('kf/8uRo6OBbQ97jCx2EIuKm8Wmt6Vb15+KsQHFLbKSMiYIny')
     *
     * new Address('-1:fcb91a3a3816d0f7b8c2c76108b8a9bc5a6b7a55bd79f8ab101c52db29232260')
     * new Address('kf_8uRo6OBbQ97jCx2EIuKm8Wmt6Vb15-KsQHFLbKSMiYIny')
     * new Address(address)
     * ```
     */
    constructor (address: string | Address) {
        const isAddress = Address.isAddress(address)
        const isEncoded = Address.isEncoded(address)
        const isRaw = Address.isRaw(address)
        let result: AddressData

        switch (true) {
            case isAddress:
                result = Address.parseAddress(address as Address)

                break
            case isEncoded:
                result = Address.parseEncoded(address as string)

                break
            case isRaw:
                result = Address.parseRaw(address as string)

                break
            default:
                result = null

                break
        }

        if (result === null) {
            throw new Error('Address: can\'t parse address. Unknown type.')
        }

        this._hash = result.hash
        this._workchain = result.workchain
        this._bounceable = result.bounceable
        this._testOnly = result.testOnly
    }

    public get hash (): Uint8Array {
        return new Uint8Array(this._hash)
    }

    public get workchain (): number {
        return this._workchain
    }

    public get bounceable (): boolean {
        return this._bounceable
    }

    public get testOnly (): boolean {
        return this._testOnly
    }

    private static isEncoded (address: any): boolean {
        // eslint-disable-next-line no-useless-escape
        const re = /^([a-zA-Z0-9_-]{48}|[a-zA-Z0-9\/\+]{48})$/

        return typeof address === 'string' && re.test(address)
    }

    private static isRaw (address: any): boolean {
        const re = /^-?[0-9]:[a-zA-Z0-9]{64}$/

        return typeof address === 'string' && re.test(address)
    }

    private static parseEncoded (value: string): AddressData {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
        const bytes = base64ToBytes(base64)
        const data = Array.from(bytes)
        const address = data.splice(0, 34)
        const hashsum = data.splice(0, 2)
        const crc = crc16BytesBe(address)

        if (!bytesCompare(crc, hashsum)) {
            throw new Error('Address: can\'t parse address. Wrong hashsum.')
        }

        const tag = address.shift()
        const workchain = uint8toInt8(address.shift())
        const hash = new Uint8Array(address.splice(0, 32))
        const { bounceable, testOnly } = Address.decodeTag(tag)

        return {
            bounceable,
            testOnly,
            workchain,
            hash
        }
    }

    private static parseAddress (value: Address): AddressData {
        const { workchain, bounceable, testOnly } = value
        const hash = new Uint8Array(value.hash)

        return {
            bounceable,
            testOnly,
            workchain,
            hash
        }
    }

    private static parseRaw (value: string): AddressData {
        const data = value.split(':')
        const workchain = parseInt(data[0], 10)
        const hash = hexToBytes(data[1])
        const bounceable = false
        const testOnly = false

        return {
            bounceable,
            testOnly,
            workchain,
            hash
        }
    }

    private static encodeTag (options: AddressTag): number {
        const { bounceable, testOnly } = options
        const tag = bounceable ? FLAG_BOUNCEABLE : FLAG_NON_BOUNCEABLE

        return testOnly ? (tag | FLAG_TEST_ONLY) : tag
    }

    private static decodeTag (tag: number): AddressTag {
        let data = tag
        const testOnly = (data & FLAG_TEST_ONLY) !== 0

        if (testOnly) {
            data ^= FLAG_TEST_ONLY
        }

        if (![ FLAG_BOUNCEABLE, FLAG_NON_BOUNCEABLE ].includes(data)) {
            throw new Error('Address: bad address tag.')
        }

        const bounceable = data === FLAG_BOUNCEABLE

        return {
            bounceable,
            testOnly
        }
    }

    /**
     * Get raw or base64 representation of {@link Address}
     *
     * @param {AddressType} [type="base64"] - Can be "base64" or "raw"
     * @param {AddressOptions} [options] - Url-safe representation (only works for base64), flags, workchain setup.
     *
     * @example
     * ```ts
     * import { Address } from '@tonstack/tontools'
     *
     * const raw = '-1:fcb91a3a3816d0f7b8c2c76108b8a9bc5a6b7a55bd79f8ab101c52db29232260'
     * const address = new Address(raw)
     *     .setBounceableFlag(true)
     *     .setTestOnlyFlag(true)
     *
     * console.log(address.toString('base64'))
     * // kf_8uRo6OBbQ97jCx2EIuKm8Wmt6Vb15-KsQHFLbKSMiYIny
     *
     * console.log(address.toString('base64', false))
     * // kf/8uRo6OBbQ97jCx2EIuKm8Wmt6Vb15+KsQHFLbKSMiYIny
     *
     * console.log(address.toString('raw'))
     * // -1:fcb91a3a3816d0f7b8c2c76108b8a9bc5a6b7a55bd79f8ab101c52db29232260
     * ```
     *
     * @returns {string}
     */
    public toString (type: AddressType = 'base64', options?: AddressOptions): string {
        const {
            workchain = this.workchain,
            bounceable = this.bounceable,
            testOnly = this.testOnly,
            urlSafe = true
        } = options || {}

        if (typeof workchain !== 'number' || workchain < -128 || workchain >= 128) {
            throw new Error('Address: workchain must be int8.')
        }

        if (typeof bounceable !== 'boolean') {
            throw new Error('Address: bounceable flag must be a boolean.')
        }

        if (typeof testOnly !== 'boolean') {
            throw new Error('Address: testOnly flag must be a boolean.')
        }

        if (typeof urlSafe !== 'boolean') {
            throw new Error('Address: urlSafe flag must be a boolean.')
        }

        if (type === 'raw') {
            return `${workchain}:${bytesToHex(this._hash)}`.toUpperCase()
        }

        const tag = Address.encodeTag({ bounceable, testOnly })
        const address = [ tag, int8ToUint8(workchain) ].concat(Array.from(this._hash))
        const hashsum = crc16BytesBe(address)
        const addressWithHashsum = address.concat(Array.from(hashsum))
        const base64 = bytesToBase64(addressWithHashsum)

        return urlSafe
            ? base64.replace(/\//g, '_').replace(/\+/g, '-')
            : base64.replace(/_/g, '/').replace(/-/g, '+')
    }

    /**
     * Helper method for writing null addresses to {@link BitArray}
     *
     * @static
     */
    public static readonly NONE = null

    private static isAddress (address: any): boolean {
        return address instanceof Address
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static isValid (address: any): boolean {
        try {
            // eslint-disable-next-line no-new
            new Address(address)

            return true
        } catch (e) {
            return false
        }
    }
}

export { Address }
