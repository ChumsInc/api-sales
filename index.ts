import 'dotenv/config.js';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import http from 'node:http';
import path from 'node:path';
import {default as libRouter} from './lib/index.js';
import Debug from 'debug';

const debug = Debug('chums:index');

const app = express();
app.set('trust proxy', 'loopback');
app.use(helmet());
app.set('json spaces', 2);
app.set('view engine', 'pug');
app.set('views', path.join(process.cwd(), '/views'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(libRouter);

const {PORT, NODE_ENV} = process.env;
const server = http.createServer(app);
server.listen(PORT);
debug(`server started on port: ${PORT}; mode: ${NODE_ENV}`);
