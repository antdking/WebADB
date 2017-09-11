import * as constants from './constants.js';

export class AdbConnector {
    constructor(device) {
        this.device = device;
    }

    static async request_device(vendorId=undefined, productId=undefined) {
        let base_filter = {
            classCode: constants.INTERFACE_CLASS,
            subclassCode: constants.INTERFACE_SUBCLASS,
            protocolCode: constants.INTERFACE_PROTOCOL,
        };
        if (vendorId !== undefined) base_filter['vendorId'] = vendorId;
        if (productId !== undefined) base_filter['productId'] = productId;

        return await navigator.usb.requestDevice({filters: [base_filter]});
    }

    async connect_to_interface() {
        if (!this.device.opened) await this.device.open();
        let connected_interface_number = null;
        for (let configuration of this.device.configurations) {
            for (let usb_interface of configuration.interfaces) {
                let adb_alternate = AdbConnector.get_adb_alternate(usb_interface);
                if (adb_alternate) {
                    await this.device.selectConfiguration(configuration.configurationValue);
                    await this.device.claimInterface(usb_interface.interfaceNumber);
                    await this.device.selectAlternateInterface(
                        usb_interface.interfaceNumber, adb_alternate.alternateSetting
                    );
                    connected_interface_number = usb_interface.interfaceNumber;
                    break;
                }
            }
        }
        return connected_interface_number;
    }
    static get_endpoint_numbers(adb_alternate) {
        console.log(adb_alternate);
        let read_endpoint = null,
            write_endpoint = null;
        for (let endpoint of adb_alternate.endpoints) {
            if (endpoint.type === 'bulk') {
                if (endpoint.direction === 'in') {
                    read_endpoint = endpoint.endpointNumber;
                } else if (endpoint.direction === 'out') {
                    write_endpoint = endpoint.endpointNumber;
                }
            }
        }
        return {
            read: read_endpoint,
            write: write_endpoint,
        };
    }
    static get_adb_alternate(usb_interface) {
        for (let alternate of usb_interface.alternates) {
            if (
                alternate.interfaceClass === constants.INTERFACE_CLASS
                && alternate.interfaceSubclass === constants.INTERFACE_SUBCLASS
                && alternate.interfaceProtocol === constants.INTERFACE_PROTOCOL
            ) {
                return alternate;
            }
        }
        return null;
    }
}
