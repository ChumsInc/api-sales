import type {Request, Response} from 'express'
import Debug from "debug";
import type {ValidatedUser} from "chums-local-modules";
import {loadRepPaceV3} from "./rep-data.js";
import {rollupRepPace} from "./utils.js";

export {getRepPaceXLSX} from './excel-handler.js'

const debug = Debug('chums:lib:rep:pace');

