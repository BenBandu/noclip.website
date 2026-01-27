import ArrayBufferSlice from "../ArrayBufferSlice";
import {assert} from "../util";
import {Endianness} from "../endian";

export enum ESeekBehaviour {
    START,
    CURRENT,
    END,
}

export type SchemaField<TStruct, TField> = TField | ((br: BinaryReader, self: Partial<TStruct>) => TField);
export type StructSchema<T> = {[K in keyof T]: SchemaField<T, T[K]>};

export class BinaryReader {
    private offset = 0;
    private readonly view : DataView;
    private readonly isLittleEndian: boolean;
    private readonly endianness: Endianness;
    private decoder : TextDecoder;

    constructor(buffer: ArrayBufferSlice, endianness: Endianness = Endianness.LITTLE_ENDIAN) {
        this.view = buffer.createDataView();
        this.decoder = new TextDecoder();
        this.endianness = endianness;
        this.isLittleEndian = endianness === Endianness.LITTLE_ENDIAN;
    }

    seek(offset: number, seek: ESeekBehaviour = ESeekBehaviour.START) {
        switch (seek) {
            case ESeekBehaviour.CURRENT:
                this.offset += offset;
                break;
            case ESeekBehaviour.END:
                this.offset = this.view.byteLength - offset;
                break;
            case ESeekBehaviour.START:
            default:
                this.offset = offset;
        }

        assert(this.offset >= 0 && this.offset <= this.view.byteLength, "BinaryReader offset outside of buffer range");
    }

    tell() {
        return this.offset;
    }

    slice(length: number) {
        const v = new ArrayBufferSlice(this.view.buffer, this.view.byteOffset + this.offset, length);
        this.offset += length;
        return v;
    }

    variableInt(): number {
        const maxIter = 10;
        const contBit = 0x80;
        const signBit = 0x40;

        let result = 0;
        for (let i = 0; i < maxIter; i++) {
            const byte = this.int8();

            const content = byte & 0x7F;
            const offset = i * 0x07;

            result |= content << offset;

            if((byte & contBit) !== 0) {
                continue;
            }

            if(byte & signBit) {
                result -= 1 << offset;
            }

            return result;
        }

        assert(false, `Max iterations reached when decoding variable length integer`);
    }

    int8()  {
        const v = this.view.getInt8(this.offset);
        this.offset += 1;
        return v;
    }

    uint8() {
        const v = this.view.getUint8(this.offset);
        this.offset += 1;
        return v;
    }

    int16() {
        const v = this.view.getInt16(this.offset, this.isLittleEndian);
        this.offset += 2;
        return v;
    }

    uint16(){
        const v = this.view.getUint16(this.offset, this.isLittleEndian);
        this.offset += 2;
        return v;
    }

    int32() {
        const v = this.view.getInt32(this.offset, this.isLittleEndian);
        this.offset += 4;
        return v;
    }

    uint32(){
        const v = this.view.getUint32(this.offset, this.isLittleEndian);
        this.offset += 4;
        return v;
    }

    int64() {
        const v = this.view.getBigUint64(this.offset, this.isLittleEndian);
        this.offset += 8;
        return v;
    }

    uint64(){
        const v = this.view.getBigUint64(this.offset, this.isLittleEndian);
        this.offset += 8;
        return v;
    }

    float32() {
        const v = this.view.getFloat32(this.offset, this.isLittleEndian);
        this.offset += 4;
        return v;
    }

    float64() {
        const v = this.view.getFloat64(this.offset, this.isLittleEndian);
        this.offset += 8;
        return v;
    }

    string(length: number, separator: string = '') {
        let b = this.slice(length).createTypedArray(Uint8Array, 0, undefined, this.endianness)
        let v = this.decoder.decode(b);
        if(separator) {
            v = v.split(separator)[0];
        }
        return v;
    }

    string0() {
        let chars: number[] = [];
        while (true) {
            if(this.offset >= this.view.byteLength) break;
            const byte = this.uint8();
            if (byte === 0x0) break;
            chars.push(byte);
        }

        const b = new Uint8Array(chars);

        return this.decoder.decode(b);
    }
}