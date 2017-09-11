import {AdbConnector} from './connector.js';


class AdbInterface {
    constructor(device, interface_number, read_endpoint, write_endpoint) {
        this.device = device;
        this._interface_number = interface_number;
        this._read_endpoint = read_endpoint;
        this._write_endpoint = write_endpoint;
    }

    static async new_device() {
        let device = await AdbConnector.request_device(),
            connector = new AdbConnector(device),
            interface_number = await connector.connect_to_interface(),
            alternate = device.configuration.interfaces[interface_number].alternate,
            endpoints = AdbConnector.get_endpoint_numbers(alternate);
        return AdbInterface(
            device,
            interface_number,
            endpoints['read'],
            endpoints['write'],
        );
    }

    async send(buffer) {
        return await this.device.transferOut(this._write_endpoint, buffer);
    }
    async read(data_length) {
        return await this.device.transferIn(this._read_endpoint, data_length);
    }
}
