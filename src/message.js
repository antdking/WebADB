
export const
    SYNC = 'SYNC',
    CONNECTION = 'CNXN',
    AUTH = 'AUTH',
    OPEN = 'OPEN',
    OKAY = 'OKAY',
    CLOSE = 'CLSE',
    WRITE = 'WRTE';

// messages are 6*ints
const MESSAGE_SIZE = 6*4;

let _command_to_id = {},
    _id_to_command = {};

function calculate_wire_id(command) {
    "use strict";
    let letter_ids = command.split('').map((val, i) => {
        let char = val.charCodeAt(0);
        return char << (i * 8);
    });
    return letter_ids.reduce((a, b) => {return a+b;}, 0);
}

function populate_command_wire_ids() {
    "use strict";
    const _commands = [
        SYNC, CONNECTION, AUTH, OPEN, OKAY, CLOSE, WRITE,
    ];
    for (let command of _commands) {
        let wire_id = calculate_wire_id(command);
        _command_to_id[command] = wire_id;
        _id_to_command[wire_id] = command;
    }
}
populate_command_wire_ids();


class AdbMessage {
    constructor(command, arg0, arg1, data) {
        this.wire_id = _command_to_id[command];
        this.magic = this.wire_id ^ 0xFFFFFFFF;
        this.arg0 = arg0;
        this.arg1 = arg1;
        this.data = data;
    }

    get checksum() {
        let sum_data = this.data.split('').reduce((acc, cur) => {
            return acc + cur.charCodeAt(0);
        });
        return sum_data & 0xFFFFFFFF;
    }

    pack() {
        // construct a message of 6 32bit little-endian integers
        let ab = new ArrayBuffer(MESSAGE_SIZE),
            dv = new DataView(ab);
        dv.setInt32(0, this.wire_id, true);
        dv.setInt32(4, this.arg0, true);
        dv.setInt32(8, this.arg1, true);
        dv.setInt32(12, this.data.length, true);
        dv.setInt32(16, this.checksum, true);
        dv.setInt32(20, this.magic, true);
        return ab;
    }

    send(adb_interface) {
        let packed_message = this.pack();
        adb_interface.send(packed_message);
    }
}

class AdbResponse {
    constructor(buffer) {
        let dv = new DataView(buffer),
            wire_id = dv.getInt32(0, true);

        this.command = _id_to_command[wire_id];
        this.arg0 = dv.getInt32(4, true);
        this.arg1 = dv.getInt32(8, true);
        this.data_length = dv.getInt32(12, true);
        this.checksum = dv.getInt32(16, true);
        this.magic = dv.getInt32(20, true);
    }
}
