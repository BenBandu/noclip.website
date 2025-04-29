import {DataFetcher, NamedArrayBufferSlice} from "../DataFetcher";
import { assert, readString } from "../util.js";
import ArrayBufferSlice from "../ArrayBufferSlice";

export interface PakNode {
    offset: number;
    fileSize: number;
    pathBlockOffset: number;
    pathBlockLength: number;
    pathStartIndex: number;
    pathSegment: string;
}

export class PakArchive {
    private static magic: string = `tlj_pack0001`;
    private static charTable = `\0abcdefghijklmnopqrstuvwxyz\\??-_'.0123456789`;

    private nodes: PakNode[];
    private pathTable: string[];
    private lenBlock: number[];

    constructor(private id: string, private pakData: NamedArrayBufferSlice) {
        this.parse();
    }

    private parse() {
        const magic = readString(this.pakData, 0, PakArchive.magic.length, false);
        assert(magic === PakArchive.magic, `Magic mismatch in pak "${this.id}"`);

        let offset = PakArchive.magic.length;
        offset += this.parseHeader(this.pakData.createDataView(offset, 0x0C));
        offset += this.parseNodes(this.pakData.createDataView(offset, 0x14 * this.nodes.length));
        offset += this.parsePathTable(this.pakData.createDataView(offset, this.pathTable.length));
        offset += this.parseLenBlock(this.pakData.createDataView(offset, 0x04 * this.lenBlock.length));
    }

    private parseHeader(data: DataView): number {
        const nodeCount = data.getInt32(0x00, true);
        const numCount = data.getInt32(0x04, true);
        const charCount = data.getInt32(0x08, true);

        this.nodes = new Array(nodeCount);
        this.lenBlock = new Array(numCount);
        this.pathTable = new Array(charCount);

        return data.byteLength;
    }

    private parseNodes(data: DataView): number {
        for(let i = 0; i < this.nodes.length; i++) {
            const nodeOffset = 0x14 * i;

            const node: PakNode = {
                offset: data.getInt32(nodeOffset, true),
                fileSize: data.getInt32(nodeOffset + 0x04, true),
                pathBlockOffset: data.getInt32(nodeOffset + 0x08, true),
                pathBlockLength: data.getInt32(nodeOffset + 0x0C, true),
                pathStartIndex: data.getInt32(nodeOffset + 0x10, true),
                pathSegment: ""
            };

            if(node.fileSize > 0) {
                node.pathBlockLength--;
            }

            this.nodes[i] = node;
        }

        return data.byteLength;
    }

    private parsePathTable(data: DataView): number {
        for(let i = 0; i < this.pathTable.length; i++) {
            this.pathTable[i] = PakArchive.charTable[data.getInt8(i)] ?? '?';
        }

        for(const node of this.nodes) {
            let i = node.pathStartIndex;
            while(i < this.pathTable.length && this.pathTable[i] !== '\0') {
                node.pathSegment += this.pathTable[i++];
            }
        }

        return data.byteLength;
    }

    private parseLenBlock(data: DataView): number {
        //TODO: Figure out what this is, and what it's used for...
        for(let i = 0; i < this.lenBlock.length; i++) {
            this.lenBlock[i] = data.getInt32(0x04 * i, true);
        }

        return data.byteLength;
    }

    public getFileData(filepath: string): ArrayBufferSlice | null {
        const node = this.findNode(filepath);
        if(node) {
            return this.pakData.subarray(node.offset, node.fileSize);
        }

        return null;
    }

    private findNode(filepath: string): PakNode | null {
        return this.traverseToNode(filepath.toLowerCase().replaceAll('/', '\\'), "", 0)!;
    }

    private traverseToNode(remainingPath: string, pathSoFar: string, offset: number): PakNode | null {
        let index = PakArchive.charTable.indexOf(remainingPath[0]);
        if(index < 0 || index >= this.pathTable.length) {
            return null;
        }

        index += offset;

        let pathSegment = remainingPath[0] + this.nodes[index].pathSegment
        if(!remainingPath.startsWith(pathSegment)) {
            return null;
        }

        pathSoFar += pathSegment;
        remainingPath = remainingPath.substring(pathSegment.length);
        if(pathSoFar.length != this.nodes[index].pathBlockLength + 1) {
            return null;
        }

        if(this.nodes[index].fileSize > 0) {
            if(remainingPath.length !== 0) {
                return null;
            }

            return this.nodes[index];
        }

        if(remainingPath.length < 1) {
            return null;
        }

        return this.traverseToNode(remainingPath, pathSoFar, this.nodes[index].pathBlockOffset);
    }
}