import ArrayBufferSlice from "../ArrayBufferSlice";
import {assert} from "../util";

enum ESeekBehaviour {
    GLOBAL,
    LOCAL,
}

export class BinaryReader {
    private offset = 0;
    private readonly view : DataView;
    private readonly littleEndian: boolean;

    constructor(buffer: ArrayBufferSlice, littleEndian = true) {
        this.view = buffer.createDataView();
        this.littleEndian = littleEndian;
    }

    seek(offset: number, seek: ESeekBehaviour = ESeekBehaviour.GLOBAL) {
        switch (seek) {
            case ESeekBehaviour.LOCAL:
                this.offset += seek;
                break;
            case ESeekBehaviour.GLOBAL:
            default:
                this.offset = seek;
        }
    }

    tell() {
        return this.offset;
    }

    slice(length: number) {
        const v = new ArrayBufferSlice(this.view.buffer, this.offset, length);
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
        const v = this.view.getInt16(this.offset, this.littleEndian);
        this.offset += 2;
        return v;
    }

    uint16(){
        const v = this.view.getUint16(this.offset, this.littleEndian);
        this.offset += 2;
        return v;
    }

    int32() {
        const v = this.view.getInt32(this.offset, this.littleEndian);
        this.offset += 4;
        return v;
    }

    uint32(){
        const v = this.view.getUint32(this.offset, this.littleEndian);
        this.offset += 4;
        return v;
    }

    int64() {
        const v = this.view.getBigUint64(this.offset, this.littleEndian);
        this.offset += 8;
        return v;
    }

    uint64(){
        const v = this.view.getBigUint64(this.offset, this.littleEndian);
        this.offset += 8;
        return v;
    }

    float32() {
        const v = this.view.getFloat32(this.offset, true);
        this.offset += 4;
        return v;
    }

    float64() {
        const v = this.view.getFloat64(this.offset, this.littleEndian);
        this.offset += 8;
        return v;
    }

    string(length: number) {
        const b = new Uint8Array(this.view.buffer, this.offset, length);
        this.offset += length;
        return new TextDecoder().decode(b);
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
        return new TextDecoder().decode(b);
    }
}