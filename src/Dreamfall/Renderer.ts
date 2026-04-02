import {SceneGfx, ViewerRenderInput} from "../viewer.js";
import {GfxBufferUsage, GfxDevice} from "../gfx/platform/GfxPlatform";
import {GfxRenderHelper} from "../gfx/render/GfxRenderHelper";
import {Scene} from "./Scene";
import {makeStaticDataBuffer} from "../gfx/helpers/BufferHelpers";


export class DreamfallRenderer implements SceneGfx  {
    private renderHelper: GfxRenderHelper;
    private level: Scene;

    constructor(device: GfxDevice, level: Scene) {
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