const _ = require('lodash');
const SerialPort = require('serialport');
const Delimiter = require('@serialport/parser-delimiter');
const Promise = require('bluebird');

module.exports = exports = (pathToPort, label, numInputs, numOutputs) => {

  let portStatus;
  const portObj = new SerialPort(pathToPort, {
    baudRate: 9600,
  });

  portObj.on('open', () => {
    portObj.set({ rts: false, cts: false, dsr: true, dtr: true });
  });

  const generateStartByte = label => {
    if (label === 'top') {
      const tmp = Buffer.alloc(1);
      tmp.writeInt8(0x62);
      return tmp;
    }
    if (label === 'bottom') {
      const tmp = Buffer.alloc(1);
      tmp.writeInt8(0x61);
      return tmp;
    }
  };

  const parser = portObj.pipe(new Delimiter({ delimiter: generateStartByte(label) }));
  parser.on('data', data => {
    if (data.length === 13) {
      portStatus = data;
    }
  });

  const isAvailable = (status, bitPos) => {
    return (status & Math.pow(2, bitPos)) > 0 ? 'available' : 'unavailable';
  };

  const getPortNumber = status => {
    switch (status) {
      case 8:
        return 4;
      case 4:
        return 3;
      default:
        return status;
    }
  };

  getOutputDetails = (status, outputs) => {
    if (outputs === 4) {
      return {
        output1: getPortNumber(status[4]),
        output2: getPortNumber(status[5]),
        output3: getPortNumber(status[6]),
        output4: getPortNumber(status[7]),
      };
    } else if (outputs === 2) {
      return {
        output1: getPortNumber(status[4]),
        output2: getPortNumber(status[5]),
      }
    } else {
      return {};
    }
  };

  getMemoryDetails = (status, outputs) => {
    if (outputs === 4) {
      return {
        output1: getPortNumber(status[0]),
        output2: getPortNumber(status[1]),
        output3: getPortNumber(status[2]),
        output4: getPortNumber(status[3]),
      };
    } else if (outputs === 2) {
      return {
        output1: getPortNumber(status[0]),
        output2: getPortNumber(status[1]),
      }
    } else {
      return {};
    }
  };

  getInputStatus = (status, _outputs) => {
    return {
      input1: isAvailable(status[8], 7),
      input2: isAvailable(status[8], 6),
      input3: isAvailable(status[8], 5),
      input4: isAvailable(status[8], 4),
    };
  };

  getOutputStatus = (status, outputs) => {
    if (outputs === 4) {
      return {
        output1: isAvailable(status[8], 3),
        output2: isAvailable(status[8], 2),
        output3: isAvailable(status[8], 1),
        output4: isAvailable(status[8], 0),
      };
    } else {
      return {};
    }
  };

  const getStatus = () => {
    if (!portStatus) return {};
    return {
      raw: [...portStatus],
      output: getOutputDetails(portStatus, numOutputs),
      memory: getMemoryDetails(portStatus, numOutputs),
      status: {
        input: getInputStatus(portStatus, numOutputs),
        output: getOutputStatus(portStatus, numOutputs),
      },
      power: portStatus[9] ? 'on' : 'off',
    };
  };

  const genCommandInt = (input, idx) => {
    if (!_.isInteger(+input)) return -1;
    return (idx * 4) + (parseInt(input) - 1);
  };

  const genCommandString = (input, idx) => {
    const cmdInt = genCommandInt(input, idx);
    if (cmdInt < 0) return '';
    return _.padStart(cmdInt.toString(16), 2, '0') + _.padStart((255 - cmdInt).toString(16), 2, '0') + 'd57b';
  };

  const runCmd = (port, cmdGroup) => {
    Promise.map(cmdGroup.split(''), (input, idx) => {
      return new Promise((resolve, reject) => {
        if (input === 'x') {
          return resolve();
        }

        _.delay(() => {
          const cmd = genCommandString(input, idx);
          _.each(cmd.match(/.{1,2}/g), (chars, charsIdx) => {
            _.delay(() => {
              port.write(Buffer.from(chars, 'hex'), (err, _results) => {
                if (err) console.error('err ' + err);
              });
            }, 50 * charsIdx);
          });

          _.delay(() => {
            port.drain(err => {
              if (err) reject(err);
              resolve();
            });
          }, 250);
        }, 500);
      });
    }, { concurrency: 1 });
  };

  const switchCmd = cmdString => {
    runCmd(portObj, cmdString);
  };

  return {
    getStatus,
    switchCmd,
    runCmd,
  };
};
