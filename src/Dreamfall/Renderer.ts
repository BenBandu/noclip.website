import {SceneGfx, ViewerRenderInput} from "../viewer.js";
import {GfxBufferUsage, GfxDevice} from "../gfx/platform/GfxPlatform";
import {GfxRenderHelper} from "../gfx/render/GfxRenderHelper";
import {Level} from "./Level";
import {makeStaticDataBuffer} from "../gfx/helpers/BufferHelpers";


export class DreamfallRenderer implements SceneGfx  {
    private renderHelper: GfxRenderHelper;
    private level: Level;

    constructor(device: GfxDevice, level: Level) {
        this.level = level;
        this.renderHelper = new GfxRenderHelper(device);

        // makeStaticDataBuffer(device, GfxBufferUsage.Vertex, GfxBufferUsage.)
    }

    render(device: GfxDevice, renderInput: ViewerRenderInput): void {
    }

    destroy(device: GfxDevice): void {
        this.renderHelper.destroy();
    }
}