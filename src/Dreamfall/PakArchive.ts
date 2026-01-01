import {DataFetcher, NamedArrayBufferSlice} from "../DataFetcher";
import { assert, readString } from "../util.js";
import ArrayBufferSlice from "../ArrayBufferSlice";
import {BinaryReader} from "./Utils";

export interface PakNode {
    offset: number;
    fileSize: number;
    nextNodeOffset: number;
    totalPathLength: number;
    pathStartIndex: number;
    isRootNode?: boolean;
    isLeafNode?: boolean;
    pathSegment?: string;
}

export class PakArchive {
    private static magic: string = `tlj_pack0001`;
    private static charTable = `\0abcdefghijklmnopqrstuvwxyz\\??-_'.0123456789`;

    private nodes: PakNode[];

    constructor(private id: string, private data: NamedArrayBufferSlice) {
        this.parse();
    }

    private parse() {
        const br = new BinaryReader(this.data);
        const magic = br.string(PakArchive.magic.length);
        assert(magic === PakArchive.magic, `Magic mismatch in pak "${this.id}"`);

        this.parseNodes(br);
    }

    private parseNodes(br: BinaryReader) {
        this.nodes = new Array<PakNode>(br.uint32());
        const stringCount = br.uint32();
        const indexBufferSize = br.uint32();

        for(let i = 0; i < this.nodes.length; i++) {
            this.nodes[i] = {
                offset: br.uint32(),
                fileSize: br.uint32(),
                nextNodeOffset: br.uint32(),
                totalPathLength: br.uint32(),
                pathStartIndex: br.uint32(),
            };
        }

        const indexBuffer = br.slice(indexBufferSize).createTypedArray(Uint8Array);

        /*
         * An array of offsets into the index buffer, each offset pointing  to the start of each string.
         * Unused for now, because nodes have an offset into the buffer as well.
         */
        // const bufferOffset = br.slice(stringCount * 4).createTypedArray(Uint32Array);


        for(const node of this.nodes) {
            const start = node.pathStartIndex;
            const end = indexBuffer.indexOf(0, start);
            node.pathSegment = [...indexBuffer.slice(start, end)]
                .map((i: number) => PakArchive.charTable[i])
                .join('');

            node.isLeafNode = node.fileSize > 0;

            const length = node.isLeafNode ? node.totalPathLength - 1 : node.totalPathLength;
            node.isRootNode = node.pathSegment.length === length;
        }
    }

    public getFile(filepath: string): ArrayBufferSlice | null {
        const node = this.findNode(filepath);
        if(node) {
            //TODO: Write file to disk for caching?
            return this.data.subarray(node.offset, node.fileSize);
        }

        return null;
    }

    private findNode(filepath: string): PakNode | undefined {
        filepath = filepath.toLowerCase().replaceAll('/', '\\');
        return this.traverseToNode(filepath, "", 0) ?? undefined;
    }

    private traverseToNode(remainingPath: string, pathSoFar: string, offset: number): PakNode | null {
        let index = PakArchive.charTable.indexOf(remainingPath[0]);
        if(index < 0 || index + offset >= this.nodes.length) {
            return null;
        }

        index += offset;
        const node = this.nodes[index];

        let pathSegment = remainingPath[0] + node.pathSegment
        if(!remainingPath.startsWith(pathSegment)) {
            return null;
        }

        pathSoFar += pathSegment;
        remainingPath = remainingPath.substring(pathSegment.length);
        if(pathSoFar.length === node.totalPathLength) {
            return node;
        } else if(remainingPath.length <= 0) {
            return null;
        } else {
            return this.traverseToNode(remainingPath, pathSoFar, this.nodes[index].nextNodeOffset);
        }
    }
}