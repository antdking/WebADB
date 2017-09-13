import {AdbConnector} from './connector.js';
import {AdbMessage, AdbResponse, CONNECTION, AUTH, MESSAGE_SIZE} from "./message.js";
import {MAX_ADB_DATA, VERSION} from "./constants.js";
import {AUTH_RSAPUBLICKEY, AUTH_SIGNATURE} from "./constants.js";


export class AdbInterface {
    constructor(device, interface_number, read_endpoint, write_endpoint) {
        this.device = device;
        this._interface_number = interface_number;
        this._read_endpoint = read_endpoint;
        this._write_endpoint = write_endpoint;

        this.banner = "WebADB";
        this._rsa_key = null;
    }

    async get_rsa_key() {
        if (!this._rsa_key) {
            this._rsa_key = await window.crypto.subtle.generateKey(
                {
                    name: "RSASSA-PKCS1-v1_5",
                    modulusLength: 2048,
                    publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
                    hash: {name: "SHA-256"},
                },
                false,
                ["sign", "verify"],
            )
        }
        return this._rsa_key;
    }

    static async new_device() {
        let device = await AdbConnector.request_device(),
            connector = new AdbConnector(device),
            interface_number = await connector.connect_to_interface(),
            alternate = device.configuration.interfaces[interface_number].alternate,
            endpoints = AdbConnector.get_endpoint_numbers(alternate);
        //console.log('clearing');
        await device.clearHalt('in', endpoints['read']);
        console.log('clearing');
        await device.clearHalt('out', endpoints['write']);
        console.log('cleared');
        return new AdbInterface(
            device,
            interface_number,
            endpoints['read'],
            endpoints['write'],
        );
    }

    async connect(read_attempts=5) {
        let msg = new AdbMessage(CONNECTION, VERSION, MAX_ADB_DATA, `host::${this.banner}\0`);
        await msg.send(this);
        let final_response = null;
        for (let attempt=0; attempt < read_attempts; attempt++) {
            let buffer = await this.read(MESSAGE_SIZE);
            console.log(buffer);
            let response = new AdbResponse(buffer);
            console.log(response);
            await response.fetch_data(this);
            if ([CONNECTION, AUTH].indexOf(response.command) !== -1) {
                final_response = response;
                break;
            }
        }
        if (!final_response) throw Error("Can't read connection response");
        console.log(final_response);
        if (final_response.command === AUTH) {
            await this.handle_auth(final_response);
        }
    }
    async handle_auth(auth_response) {
        let banner = auth_response.data,
            rsa_key = await this.get_rsa_key(),
            signed_token = await window.crypto.subtle.sign('RSASSA-PKCS1-v1_5', rsa_key.privateKey, banner),
            msg, response;
        if (!auth_response.arg0 === AUTH_TOKEN) {
            throw Error("Unknown auth response");
        }

        msg = new AdbMessage(AUTH, AUTH_SIGNATURE, 0, signed_token);
        await msg.send(this);
        response = new AdbResponse(await this.read(MESSAGE_SIZE));
        console.log(response);
        await response.fetch_data(this);

        if (response.command === CONNECTION)
            return;

        msg = new AdbMessage(AUTH, AUTH_RSAPUBLICKEY, 0, rsa_key.publicKey + '\0');
        await msg.send(this);
        response = new AdbResponse(await this.read(MESSAGE_SIZE));
        await response.fetch_data(this);
        if (response.command !== CONNECTION)
            console.log(response);
    }

    async send(buffer) {
        return await this.device.transferOut(this._write_endpoint, buffer);
    }
    async read(data_length) {
        return await this.device.transferIn(this._read_endpoint, data_length);
    }
}
