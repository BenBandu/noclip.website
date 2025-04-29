import { SceneDesc, SceneGroup, SceneGfx } from '../viewer.js';
import {GfxDevice} from "../gfx/platform/GfxPlatform";
import {SceneContext} from "../SceneBase";
import * as Viewer from '../viewer.js';
import {PakArchive, PakNode} from "./PakArchive";
import {Shark3D} from "./Shark3D";
import {EmptyScene} from "../Scenes_Test";

export class DreamfallSceneDesc implements SceneDesc {
    private static basePath: string = `Dreamfall/bin/res`;

    constructor(public id: string, public name: string) {
    }

    public async createScene(device: GfxDevice, sceneContext: SceneContext): Promise<SceneGfx> {
        const pak = new PakArchive(this.id, await sceneContext.dataFetcher.fetchData(`${DreamfallSceneDesc.basePath}/${this.id}.pak`));
        const shark = new Shark3D(this.id, pak.getFileData(`data/generated/locations/${this.id}.cdr`)!);

        return new EmptyScene();
    }
}
const id = "dtlj"
const name = "Dreamfall: The Longest Journey";
const sceneDescs = [
    "Stark - Casablanca",
    new DreamfallSceneDesc("hospital_room",             "Hospital"),
    new DreamfallSceneDesc("castillo_home",             "Castillo Home"),
    new DreamfallSceneDesc('jardin_des_roses',          "Jardin Des Roses"),
    new DreamfallSceneDesc('the_souk',                  "The Souk"),
    new DreamfallSceneDesc('la_place_du_sucre',         "La Place Du Sucre"),
    new DreamfallSceneDesc("olivias_shop",              "Alien The Cat"),
    new DreamfallSceneDesc("the_gym",                   "The Gym"),
    new DreamfallSceneDesc("rezas_apartment_building",  "Apartment Building"),
    new DreamfallSceneDesc('underground_entrance',      "Jiva Entrance"),
    new DreamfallSceneDesc("jiva",                      "Jiva"),
    new DreamfallSceneDesc("interrogation_room",        "EYE Interrogation Room"),

    "Stark - Newport",
    new DreamfallSceneDesc("crossroads",            "Crossroads"),
    new DreamfallSceneDesc("marco_polo",            "MarcoPolo"),
    new DreamfallSceneDesc("victory_hotel",         "Victory Hotel"),
    new DreamfallSceneDesc("victory_hotel_backyard","Victory Hotel Backyard"),
    new DreamfallSceneDesc("fringe_cafe",           "Fringe Cafe"),

    "Stark - Japan",
    new DreamfallSceneDesc("japan_streets",             "WATI City"),
    new DreamfallSceneDesc("reception",                 "WATIcorp Reception"),
    new DreamfallSceneDesc("elevator",                  "WATIcorp Elevator"),
    new DreamfallSceneDesc("damiens_office",            "WATIcorp Offices"),
    new DreamfallSceneDesc("wati_dreamcore",            "WATIcorp Dreamcore"),
    new DreamfallSceneDesc("arboretum",                 "WATIcorp Arboretum"),
    new DreamfallSceneDesc("alley",                     "WATIcorp Alley"),
    new DreamfallSceneDesc("damiens_apartment",         "Damien's Apartment (Day)"),
    new DreamfallSceneDesc("damiens_apartment_night",   "Damien's Apartment (Night)"),

    "Stark - Russia",
    new DreamfallSceneDesc("russia_outside",    "Street"),
    new DreamfallSceneDesc("russia_inside",     "Factory"),

    "Stark - Tibet",
    new DreamfallSceneDesc("tibet",         "Temple"),
    new DreamfallSceneDesc("tibet_exterior","Mountain"),

    "Stark - Travel",
    new DreamfallSceneDesc("vactrax",   "Vactrax"),
    new DreamfallSceneDesc("hydrofoil", "Hydrofoil"),
    new DreamfallSceneDesc("scramjet",  "Scramjet"),

    "Arcadia - Underground",
    new DreamfallSceneDesc("undergroundcave",   "Cave"),
    new DreamfallSceneDesc("necropolis",        "Dungeon"),
    new DreamfallSceneDesc("temple_square",     "Temple"),
    new DreamfallSceneDesc("dream_chamber",     "Dream Chamber"),

    "Arcadia - Marcuria",
    new DreamfallSceneDesc("inn_cellar",        "The Journey Man Cellar (Day)"),
    new DreamfallSceneDesc("inn_cellar_night",  "The Journey Man Cellar (Night)"),
    new DreamfallSceneDesc("inn_mainhall_day",  "The Journey Man (Day)"),
    new DreamfallSceneDesc("inn_mainhall_night","The Journey Man (Night)"),
    new DreamfallSceneDesc("outside_inn_day",   "Street (Day)"),
    new DreamfallSceneDesc("outside_inn_night", "Street (Night)"),
    new DreamfallSceneDesc("tower_square_day",  "Tower Square (Day)"),
    new DreamfallSceneDesc("tower_square_night","Tower Square (Night)"),
    new DreamfallSceneDesc("inside_tower",      "Tower Office (Day)"),
    new DreamfallSceneDesc("inside_tower_night","Tower Office (Night)"),
    new DreamfallSceneDesc("south_gate_day",    "South Gate (Day)"),
    new DreamfallSceneDesc("south_gate_night",  "South Gate (Night)"),
    new DreamfallSceneDesc("magic_ghetto_day",  "Magic Ghetto"),
    new DreamfallSceneDesc("magic_docks_day",   "Magic Docks"),
    new DreamfallSceneDesc("prison",            "Friars Keep Exterior"),
    new DreamfallSceneDesc("inside_friars_keep","Friars Keep Interior"),

    "Arcadia - Sadir",
    new DreamfallSceneDesc("the_war_garden",    "The War Garden"),
    new DreamfallSceneDesc("the_council_room",  "The Council Room"),

    "Arcadia - The Dark People's City",
    new DreamfallSceneDesc("dark_peoples_city_mothertree",  "Mother Tree"),
    new DreamfallSceneDesc("dark_peoples_city_library",     "Library"),

    "Arcadia - Swamp",
    new DreamfallSceneDesc("swamp_city",        "Ship Wreck"),
    new DreamfallSceneDesc("swamp_city_town",   "Town"),
    new DreamfallSceneDesc("chawans_hut",       "Chawan's Hut"),

    "Arcadia - Travel",
    new DreamfallSceneDesc("airship", "Airship"),

    "In-Between Worlds",
    new DreamfallSceneDesc("guardians_realm",   "The Guardian's Realm"),
    new DreamfallSceneDesc("the_winter",        "The Winter"),
    new DreamfallSceneDesc("winter_past",       "Winter Past"),
];

export const sceneGroup: Viewer.SceneGroup = {id, name, sceneDescs}