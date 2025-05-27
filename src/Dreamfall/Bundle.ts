import ArrayBufferSlice from "../ArrayBufferSlice";
import {readString, assert} from "../util";

interface VertexBufferInfo {
    size: number;
    length: number;
    offset: number;
}

interface MeshHeader {
    nameOffset: number;
    scale: number;
    center: number[];
    bounds: number[];
    boneCount: number;
    boneNameOffset: number;
    boneDataOffset: number;
    textureCount: number;
    textureOffset: number;
    submeshCount: number;
}

interface SubMeshHeader {
    magicCount: number;
    magicOffset: number;
    formatIdx: number;
    bitcode: number;
    usage: number;
    indexCount: number;
    indexOffset: number;
    boneUsageCount: number;
    boneUsageOffset: number;
    boneStagesCount: number;
    boneVerticesOffset: number;
    boneIndexOffset: number;
    boneAssignOffset: number;
    xTableCount: number;
    xTableOffset: number;
    tax1Count: number;
    tax1Offset: number;
    tax2Count: number;
    tax2Offset: number;
    tax3Count: number;
    tax3Offset: number;
    texStageCount: number;
    stageVerticesOffset: number;
    stageIndexOffset: number;
    stageUnknownOffset: number;
    stageAssignOffset: number;
    animCount: number;
    animOffset: number;
    vertexCount: number;
    indexBonusCount: number;
    indexBonusOffset: number;
    textureCount: number;
}

interface SubMeshData {
    header: SubMeshHeader;
    textureOffsets: number[],
    magic: number[],
    indices: Uint16Array,
    boneUsage: number[],
    boneVertices: number[],
    boneIndices: number[],
    boneAssign: number[],
    tax1: number[],
    tax2: number[],
    tax3: number[],
    xTable: number[],
    stageVertices: number[],
    stageIndices: number[],
    stageUnknown: number[],
    stageAssign: number[],
    bonus1: number[],
    bonus2: number[],
    bonusIndices: number[],
    animKeys: number[],
    tex: TextureData[],
}

interface MeshData {
    header: MeshHeader;
    name: string;
    bones: BoneData[];
    textures: string[];
    subMeshes: SubMeshData[];
}

interface BoneData {
    name: string;
    data: number[];
}

interface TextureData {
    cf1: number,
    cf2: number,
    offset: number,
    unknown: number;
    indices: number[],
}

export interface ModelInfo {
    offset: number;
    name: string;
    vIndex: number;
    mesh: MeshData | null;
}

interface AttributeDescriptor {
    size: number;
    channels: number[];
    count: number;
}

interface FileData {
    offset: number;
    name: string;
    models: ModelInfo[] | null;
}

export class Bundle {
    private vertexOffset: number;
    private modelStartOffset: number;
    public textures: string[];
    public files: FileData[];
    public vertexBufferInfo: VertexBufferInfo[];
    public attributeDescriptorInfo: AttributeDescriptor[];

    constructor(public data: ArrayBufferSlice) {
        this.parseHeader();
    }

    getModelData(fileName: string, modelName: string): null | ModelInfo {
        const file = this.files.find((file) => fileName === file.name);
        if(!file) {
            return null;
        }

        const model = file.models!.find((model) => model.name === modelName);
        if(!model) {
            return null;
        }

        if(!this.parseMesh(model)) {
            return null;
        }

        return model;
    }

    private parseHeader() {
        let data = this.data.createDataView();
        let offset = 0;

        this.vertexOffset = data.getInt32(offset, true) + 4;
        offset += 4;

        const textureCount = data.getInt32(offset, true);
        offset += 4;

        this.textures = new Array(textureCount);
        for(let i = 0; i < textureCount; i++) {
            offset += 1; // Skip a byte that describes the length, since the strings are null-terminated anyway
            this.textures[i] = readString(this.data, offset);
            offset += this.textures[i].length + 1;
        }

        assert(offset == this.vertexOffset, `Offset: ${offset}, Expected: ${this.vertexOffset}`);

        const vertexBufferCount = data.getInt32(offset, true);
        offset += 4;

        this.vertexBufferInfo = new Array(vertexBufferCount);
        for (let i = 0; i < this.vertexBufferInfo.length; i++) {
            this.vertexBufferInfo[i] = {
                size: data.getInt32(offset, true),
                length: data.getInt32(offset + 4, true),
                offset: offset + 8,
            }

            offset += 8 + this.vertexBufferInfo[i].length;
        }

        this.modelStartOffset = offset;

        const modelCount = data.getInt32(offset, true);
        offset += 4;
        const streamCount = data.getInt32(offset, true);
        offset += 4;

        offset += 4; // Jump over unused/unknown value

        this.files = new Array(modelCount);
        for(let i = 0; i < this.files.length; i++) {
            this.files[i] = {offset: data.getUint32(offset, true), name: "", models: null};
            offset += 4;
        }

        const descriptorSize = 4 * 18; // 18 numbers of 4 bytes
        this.attributeDescriptorInfo = new Array(streamCount);
        for(let i = 0; i < this.attributeDescriptorInfo.length; i++) {
            const size = data.getInt32(offset, true);
            offset += 4;

            let channels: number[] = new Array(16);
            for(let j = 0; j < channels.length; j++) {
                channels[j] = data.getInt32(offset, true);
                offset += 4;
            }

            const count = data.getInt32(offset, true) + 1;
            offset += 4;

            this.attributeDescriptorInfo[i] = {
                size: size,
                channels: channels,
                count: count,
            };
        }

        let vIndex = 0;
        for(let i = 0; i < this.files.length; i++) {
            const file = this.files[i];
            offset = this.modelStartOffset + file.offset;
            file.name = readString(this.data, offset);
            offset += 0x80; // Model name is null terminated, but has 0x80 of space reserved

            const meshCount = data.getInt32(offset, true);
            offset += 4;

            file.models = new Array(meshCount);
            for(let j = 0; j < meshCount; j++) {
                file.models[j] = {
                    offset: data.getInt32(offset, true),
                    name: "",
                    vIndex: 0,
                    mesh: null,
                }

                offset += 4;
            }

            for(let j = 0; j < meshCount; j++) {
                const model = file.models[j];

                offset = this.modelStartOffset + model.offset;
                offset = this.modelStartOffset + data.getInt32(offset, true);

                model.name = readString(this.data, offset);
                model.vIndex = vIndex;

                offset = this.modelStartOffset + model.offset + 0x54;

                const partCount = data.getInt32(offset, true);
                offset += 4;

                for (let k = 0; k < partCount; k++) {
                    offset = this.modelStartOffset + model.offset + 0x58 + (4 * k);
                    offset = this.modelStartOffset + data.getInt32(offset, true) + 0x50;

                    const descriptorOffset = data.getInt32(offset, true);
                    offset += 4;
                    if(descriptorOffset == 0) {
                        continue;
                    }

                    const bitcode = data.getInt32(offset, true);
                    offset += 4;
                    if(bitcode == 0) {
                        continue;
                    }

                    const unused = data.getInt32(offset, true);
                    offset += 4;

                    // divide offset by 4 to get the data in DWORD size
                    // subtract the mount of files and subtract size of header data
                    // divide the length of the data for each file
                    // which gives us the index into th array
                    const descriptorIndex = (descriptorOffset / 4 - this.files.length - 3) / 18;
                    if(this.attributeDescriptorInfo[descriptorIndex].size != 0) {
                        offset += 0x6C;
                        vIndex += data.getInt32(offset, true);
                    }
                }
            }
        }
    }

    private parseMesh(model: ModelInfo): boolean {
        let baseOffset = this.modelStartOffset + model.offset;
        const headerSize = 88;

        const headerData = this.data.createDataView(baseOffset, headerSize);
        let offset = 0;

        const header: MeshHeader = {
            nameOffset: headerData.getUint32(offset, true),
            scale: 1.0 - headerData.getFloat32(offset += 4, true),
            center: [
                headerData.getFloat32(offset += 4, true),
                headerData.getFloat32(offset += 4, true),
                headerData.getFloat32(offset += 4, true)
            ],
            bounds: [
                headerData.getFloat32(offset += 4, true),
                headerData.getFloat32(offset += 4, true),
                headerData.getFloat32(offset += 4, true)
            ],
            boneCount: headerData.getUint32(offset += 28, true), // Skip unknown section
            boneNameOffset: headerData.getUint32(offset += 4, true),
            boneDataOffset: headerData.getUint32(offset += 4, true),
            textureCount: headerData.getUint32(offset += 4, true),
            textureOffset: headerData.getUint32(offset += 4, true),
            submeshCount: headerData.getUint32(offset += 12, true), // skip unknown section
        }
        offset += 4;

        if(!header.submeshCount) {
            return false;
        }

        baseOffset += headerSize;
        const meshSize =
            4 * header.submeshCount +
            model.name.length + 1 +
            68 * header.boneCount +
            4 * header.textureCount;

        const meshData = this.data.createDataView(baseOffset, meshSize);
        offset = 0;

        const mesh: MeshData = {
            header: header,
            name: '',
            bones: [],
            textures: [],
            subMeshes: [],
        }

        //TODO: These should probably use the Uint32Array equivalent instead of making js arrays

        mesh.subMeshes = Array.from({length: header.submeshCount},
            (_, i) => {
                const submeshOffset = meshData.getUint32(offset + i * 4, true);
                return this.parseSubMesh(this.modelStartOffset + submeshOffset);
            }
        );
        offset += 4 * header.submeshCount;

        mesh.name = readString(this.data, baseOffset + offset);
        offset += mesh.name.length + 1;

        const nameLength = 40;
        const dataLength = 28;
        for(let i = 0; i < header.boneCount; i++) {
            const nameOffset = baseOffset + offset + i * nameLength;
            const dataOffset = offset + (nameLength * header.boneCount) + (i * dataLength);

            mesh.bones.push({
                name: readString(this.data, nameOffset),
                data: Array.from({length: 7},
                    (_, j) => meshData.getFloat32(dataOffset + j * 4, true)
                )
            });
        }
        offset += (nameLength + dataLength) * header.boneCount;

        mesh.textures = Array.from({length: header.textureCount},
            (_, i) => {
                const index = meshData.getInt32(offset + i * 4, true);
                return this.textures[index];
            },
        );

        model.mesh = mesh;
        return true;
    }

    private parseSubMesh(submeshOffset: number): SubMeshData {
        const headerSize = 264;
        const meshDataOffset = submeshOffset + headerSize;
        const headerData = this.data.createDataView(submeshOffset, headerSize);
        let offset = 72; // Skip unknown section

        const header: SubMeshHeader = {
            magicCount: headerData.getInt32(offset, true),
            magicOffset: headerData.getUint32(offset += 4, true),
            formatIdx: headerData.getInt32(offset += 4, true),
            bitcode: headerData.getInt32(offset += 4, true),
            usage: headerData.getInt32(offset += 4, true),
            indexCount: headerData.getInt32(offset += 12, true), // skip unknown section
            indexOffset: headerData.getUint32(offset += 4, true),
            boneUsageCount: headerData.getInt32(offset += 4, true),
            boneUsageOffset: headerData.getUint32(offset += 4, true),
            boneStagesCount: headerData.getInt32(offset += 4, true),
            boneVerticesOffset: headerData.getUint32(offset += 4, true),
            boneIndexOffset: headerData.getUint32(offset += 4, true),
            boneAssignOffset: headerData.getInt32(offset += 4, true),
            xTableCount: headerData.getInt32(offset += 4, true),
            xTableOffset: headerData.getUint32(offset += 4, true),
            tax1Count: headerData.getInt32(offset += 20, true), // skip unknown section
            tax1Offset: headerData.getUint32(offset += 4, true),
            tax2Count: headerData.getInt32(offset += 4, true),
            tax2Offset: headerData.getUint32(offset += 4, true),
            tax3Count: headerData.getInt32(offset += 4, true),
            tax3Offset: headerData.getUint32(offset += 4, true),
            texStageCount: headerData.getInt32(offset += 4, true),
            stageVerticesOffset: headerData.getUint32(offset += 4, true),
            stageIndexOffset: headerData.getUint32(offset += 4, true),
            stageUnknownOffset: headerData.getUint32(offset += 4, true),
            stageAssignOffset: headerData.getUint32(offset += 4, true),
            animCount: headerData.getInt32(offset += 4, true),
            animOffset: headerData.getUint32(offset += 4, true),
            vertexCount: headerData.getInt32(offset += 4, true),
            indexBonusCount: headerData.getInt32(offset += 44, true), // skip unknown section
            indexBonusOffset: headerData.getUint32(offset += 4, true),
            textureCount: headerData.getInt32(offset += 4, true),
        };
        offset += 4;

        //TODO: Pre-calculate size of submesh instead?
        const meshData = this.data.createDataView(meshDataOffset);
        offset = 0;

        const submesh: SubMeshData = {
            header: header,
            textureOffsets: [],
            magic: [],
            indices: new Uint16Array(header.indexCount),
            boneUsage: [],
            boneVertices: [],
            boneIndices: [],
            boneAssign: [],
            tax1: [],
            tax2: [],
            tax3: [],
            xTable: [],
            stageVertices: [],
            stageIndices: [],
            stageUnknown: [],
            stageAssign: [],
            animKeys: [],
            bonus1: [],
            bonus2: [],
            bonusIndices: [],
            tex: [],
        }

        //TODO: These should probably use the Uint32Array (or an equivalent) instead of making js arrays

        submesh.textureOffsets = Array.from({length: header.textureCount},
            (_, i) => meshData.getUint32(offset + i * 4, true)
        );
        offset += 4 * submesh.textureOffsets.length;

        submesh.magic = Array.from({length: header.magicCount},
            (_, i) => meshData.getUint32(offset + i * 4, true)
        );
        offset += 4 * submesh.magic.length;

        submesh.indices = this.data.createTypedArray(Uint16Array, meshDataOffset + offset, header.indexCount);
        offset += 2 * submesh.indices.length;

        submesh.boneUsage = Array.from({length: header.boneUsageCount},
            (_, i) => meshData.getUint16(offset + i * 2, true)
        );
        offset += 2 * submesh.boneUsage.length;

        submesh.boneVertices = Array.from({length: header.boneStagesCount},
            (_, i) => meshData.getUint16(offset + i * 2, true)
        );
        offset += 2 * submesh.boneVertices.length;

        submesh.boneIndices = Array.from({length: header.boneStagesCount},
            (_, i) => meshData.getUint16(offset + i * 2, true)
        );
        offset += 2 * submesh.boneIndices.length;

        if(header.boneAssignOffset !== 0) {
            submesh.boneAssign = Array.from({length: header.boneStagesCount},
                (_, i) => meshData.getUint16(offset + i * 2, true)
            );
            offset += 2 * submesh.boneAssign.length;
        }

        submesh.tax1 = Array.from({length: header.tax1Count},
            (_, i) => meshData.getUint32(offset + i * 4, true)
        );
        offset += 4 * submesh.tax1.length;

        submesh.tax2 = Array.from({length: header.tax1Count},
            (_, i) => meshData.getUint32(offset + i * 4, true)
        );
        offset += 4 * submesh.tax2.length;

        submesh.tax3 = Array.from({length: header.tax1Count},
            (_, i) => meshData.getUint32(offset + i * 4, true)
        );
        offset += 4 * submesh.tax3.length;

        submesh.xTable = Array.from({length: header.xTableCount},
            (_, i) => meshData.getUint8(offset + i)
        );
        offset += header.xTableCount;

        submesh.stageVertices = Array.from({length: header.texStageCount},
            (_, i) => meshData.getInt32(offset + i * 4, true)
        );
        offset += 4 * submesh.stageVertices.length;

        submesh.stageIndices = Array.from({length: header.texStageCount},
            (_, i) => meshData.getInt32(offset + i * 4, true)
        );
        offset += 4 * submesh.stageVertices.length;

        if(header.stageUnknownOffset !== 0) {
            submesh.stageUnknown = Array.from({length: header.texStageCount},
                (_, i) => meshData.getInt32(offset + i * 4, true)
            );
            offset += 4 * submesh.stageUnknown.length;
        }

        submesh.stageAssign = Array.from({length: header.texStageCount},
            (_, i) => meshData.getInt32(offset + i * 4, true)
        );
        offset += 4 * submesh.stageAssign.length;

        submesh.animKeys = Array.from({length: header.animCount},
            (_, i) => meshData.getFloat32(offset + i * 4, true)
        );
        offset += 4 * submesh.animKeys.length;

        if((header.usage & 1) !== 0) {
            // Colors / Normals?
            submesh.bonus1 = Array.from({length: header.vertexCount * 3},
                (_, i) => meshData.getUint32(offset + i * 4, true)
            );
            offset += 4 * submesh.bonus1.length;
        }

        if((header.usage & 2) !== 0) {
            // Colors / Normals?
            submesh.bonus2 = Array.from({length: header.vertexCount * 3},
                (_, i) => meshData.getUint32(offset + i * 4, true)
            );
            offset += 4 * submesh.bonus2.length;
        }

        if(header.indexBonusCount !== 0) {
            submesh.bonusIndices = Array.from({length: header.indexBonusCount},
                (_, i) => meshData.getUint32(offset + i * 4, true)
            );
            offset += 4 * submesh.bonus2.length;
        }

        for(let i = 0; i < header.textureCount; i++) {
            submesh.tex.push({
                cf1: meshData.getUint32(offset, true),
                cf2: meshData.getUint32(offset += 4, true),
                offset: meshData.getUint32(offset += 4, true),
                unknown: meshData.getUint32(offset += 4, true),
                indices: [],
            });

            submesh.tex[i].indices = Array.from({length: header.texStageCount},
                (_, j) => meshData.getInt32(offset + j * 4, true)
            );
        }


        return submesh;
    }
}