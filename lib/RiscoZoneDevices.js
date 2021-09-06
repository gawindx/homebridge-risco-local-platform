'use strict';

var pjson = require('homebridge-riscolan-platform/package');

class RiscoCPBaseDetectors {
    constructor(log, accConfig, api, accessory) {
        this.log = log;
        this.name = accConfig.context.name;
        this.RiscoSession = accConfig.RiscoSession;
        this.Type = accConfig.context.accessorytype;
        this.RiscoDetectorId = accConfig.context.Id;
        this.DeviceInstance = accConfig.context.ObjInst;
        this.accessory = accessory;
        this.api = api;
        this.IsWireless = accConfig.context.IsWireless;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.secondCharac = undefined;

        this.SetServicesAccessory();
        this.SetExcludeServicesAccessory();
        // Battery Characteristic for Wireless Device
        this.SetBatteryServicesAccessory();
        this.DefineAccessoryVariable();

        // Default Value
        this.log.debug(`${this.sPrefix} "${this.name}" default State: ${(this.DeviceInstance.Open) ? this.ActiveStr : this.InactiveStr}`, );

        //avoid maxlistener warning
        const MaxApiListeners = this.api.getMaxListeners();
        const ActualListeners = this.api.listenerCount('shutdown');
        this.log.debug(`Api Event Shutdown : \nActual Listener :${this.api.listenerCount('shutdown')} for Maximum : ${MaxApiListeners}`);
        if (ActualListeners >= MaxApiListeners) {
            //give one more for other process
            this.api.setMaxListeners(ActualListeners + 2);
            this.log.debug('Max Listener Exceeded. Set To :%s', (ActualListeners + 2));
        }

        this.api.once('shutdown', () => {
            this.log.debug('Cleaning Before Exit.\nRemove All Listeners for %s', this.name);
            this.removemainListeners();
            this.removeExcludeListeners();
        });

        // Fix Initial States
        this.mainService.updateCharacteristic(this.mainCharac, this.DeviceInstance.Open);
        if (this.secondCharac !== undefined) {
            this.mainService.updateCharacteristic(this.secondCharac, this.DeviceInstance.Open);
        }
        this.ExcludeService.updateCharacteristic(this.Characteristic.On, this.DeviceInstance.Bypass);

        this.DeviceInstance.on('Open', () => {
            this.mainService.updateCharacteristic(this.mainCharac, (this.DeviceInstance.Open) ? false : true);
        });
        this.DeviceInstance.on('Closed', () => {
            this.mainService.updateCharacteristic(this.mainCharac, (this.DeviceInstance.Open) ? false : true);
        });
        this.DeviceInstance.on('Bypassed', () => {
            this.ExcludeService.updateCharacteristic(this.Characteristic.On, this.DeviceInstance.Bypass);
        });
        this.DeviceInstance.on('UnBypassed', () => {
            this.ExcludeService.updateCharacteristic(this.Characteristic.On, this.DeviceInstance.Bypass);
        });
        this.DeviceInstance.on('Tamper', () => {
            this.mainService.updateCharacteristic(this.Characteristic.StatusTampered, ((this.DeviceInstance.Tamper) ? 1 : 0));
        });
        this.DeviceInstance.on('Hold', () => {
            this.mainService.updateCharacteristic(this.Characteristic.StatusTampered, ((this.DeviceInstance.Tamper) ? 1 : 0));
        });
        let DeviceFault = this.DeviceInstance.Trouble || this.DeviceInstance.Lost || this.DeviceInstance.CommTrouble || this.DeviceInstance.SoakTest;

        this.DeviceInstance.on('Trouble', () => {
            this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((DeviceFault) ? 1 : 0));
        });
        this.DeviceInstance.on('Sureness', () => {
            this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((DeviceFault) ? 1 : 0));
        });
        this.DeviceInstance.on('CommTrouble', () => {
            this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((DeviceFault) ? 1 : 0));
        });
        this.DeviceInstance.on('CommOk', () => {
            this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((DeviceFault) ? 1 : 0));
        });

        
        if (this.IsWireless) {
            this.DeviceInstance.on('LowBattery', () => {
                this.BatteryService.updateCharacteristic(this.Characteristic.StatusLowBattery, 10);
            });
            this.DeviceInstance.on('BatteryOk', () => {
                this.BatteryService.updateCharacteristic(this.Characteristic.StatusLowBattery, 100);
            });
        }
    }

    SetBatteryServicesAccessory() {
        if (this.IsWireless) {
            this.log.debug(`Adding Battery Status to ${this.name}`);
            this.BatteryService = this.accessory.getService(this.Service.Battery, this.accessory.displayName);
            this.BatteryService
                .getCharacteristic(this.Characteristic.StatusLowBattery)
                .on('get', this.getCurrentBatteryState.bind(this));
            this.BatteryService
                .getCharacteristic(this.Characteristic.BatteryLevel)
                .on('get', this.getCurrentBatteryLevel.bind(this));
        }
    }

    SetExcludeServicesAccessory() {
        this.log.debug('Adding Exclude Switch to %s', this.name);
        this.ExcludeService = this.accessory.getService(this.Service.Switch, this.accessory.displayName);
        this.ExcludeService
            .getCharacteristic(this.Characteristic.On)
            .on('get', this.getCurrentExcludeState.bind(this))
            .on('set', this.setCurrentExcludeState.bind(this));
    }

    removeExcludeListeners() {
         this.ExcludeService
            .getCharacteristic(this.Characteristic.On)
            .removeListener('get', this.getCurrentExcludeState)
            .removeListener('set', this.setCurrentExcludeState);
    }

    async getCurrentState(callback) {
        try {
            this.log.debug('%s "%s" MotionDetected: %s', this.sPrefix, this.name, ((this.DeviceInstance.Open) ? this.ActiveStr : this.InactiveStr));
            callback(null, this.DeviceInstance.Open);
            return;
        } catch (err) {
            this.log.error('Error on RiscoCPBaseDetectors/getCurrentState:\n%s', err);
            callback(null, this.DeviceInstance.Open);
            return;
        }
    }

    async getCurrentExcludeState(callback) {
        try {
            this.log.debug(`${this.sPrefix} "${this.name}" Exclude State : (${this.DeviceInstance.Bypass}) => ${(this.DeviceInstance.Bypass) ? 'Bypassed': 'Not Bypassed'}`);
            callback(null, this.DeviceInstance.Bypass);
            return;
        } catch (err) {
            this.log.error('Error on RiscoCPBaseDetectors/getCurrentExcludeState:\n%s', err);
            callback(err, this.DeviceInstance.Bypass);
            return;
        }
    }

    async setCurrentExcludeState(state, callback) {
          try {
            await this.DeviceInstance.ToggleBypass();
            this.ExcludeService.updateCharacteristic(this.Characteristic.On, this.DeviceInstance.Bypass);
        } catch (err) {
            this.log.error('Error on RiscoCPBaseDetectors/setCurrentExcludeState:\n%s', err);
            this.ExcludeService.updateCharacteristic(this.Characteristic.On, this.DeviceInstance.Bypass);
            callback(err);
            return;
        }
    }

    async getCurrentBatteryState(callback) {
        try {
            this.log.debug(`${this.sPrefix} "${this.name}" Battery State : (${this.DeviceInstance.LowBattery}) => ${(this.DeviceInstance.LowBattery) ? 'Not Ok': 'Ok'}`);
            callback(null, (this.DeviceInstance.LowBattery) ? 1 : 0);
            return;
        } catch (err) {
            this.log.error('Error on RiscoCPBaseDetectors/getCurrentBatteryState:\n%s', err);
            callback(null, (this.DeviceInstance.LowBattery) ? 1 : 0);
            return;
        }
    }

    async getCurrentBatteryLevel(callback) {
        try {
            this.log.debug(`${this.sPrefix} "${this.name}" Battery Level (Fake) : (${this.DeviceInstance.LowBattery}) => ${(this.DeviceInstance.LowBattery) ? '10': '100'}`);
            callback(null, (this.DeviceInstance.LowBattery) ? 10 : 100);
            return;
        } catch (err) {
            this.log.error('Error on RiscoCPBaseDetectors/getCurrentBatteryLevel:\n%s', err);
            callback(null, (this.DeviceInstance.LowBattery) ? 10 : 100);
            return;
        }
    }

    async getCurrentTamperState(callback) {
        try {
            this.log.debug(`${this.sPrefix} "${this.name}" Tamper State : (${this.DeviceInstance.Tamper}) => ${(this.DeviceInstance.Tamper) ? 'Not Ok': 'Ok'}`);
            callback(null, (this.DeviceInstance.Tamper) ? 1 : 0);
            return;
        } catch (err) {
            this.log.error('Error on RiscoCPBaseDetectors/getCurrentTamperState:\n%s', err);
            callback(null, (this.DeviceInstance.Tamper) ? 1 : 0);
            return;
        }
    }

    async getCurrentFaultState(callback) {
        try {
            this.log.debug(`${this.sPrefix} "${this.name}" Battery State : (${this.DeviceInstance.LowBattery}) => ${(this.DeviceInstance.LowBattery) ? 'Not Ok': 'Ok'}`);
            callback(null, (this.DeviceInstance.LowBattery) ? 1 : 0);
            return;
        } catch (err) {
            this.log.error('Error on RiscoCPBaseDetectors/getCurrentFaultState:\n%s', err);
            callback(null, (this.DeviceInstance.LowBattery) ? 1 : 0);
            return;
        }
    }
}

class RiscoCPDetectors extends RiscoCPBaseDetectors {
    constructor(log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.MotionSensor, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.MotionDetected)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusTampered)
            .on('get', this.getCurrentTamperState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusFault)
            .on('get', this.getCurrentFaultState.bind(this));
        this.sPrefix = 'Detector';
    }

    DefineAccessoryVariable() {
        this.mainCharac = this.Characteristic.MotionDetected;
        this.ActiveValue = true;
        this.InactiveValue = false;
        this.ActiveStr = 'Active';
        this.InactiveStr = 'Inactive';
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.MotionDetected)
            .removeListener('get', this.getCurrentState);
    }
}

class RiscoCPCDoor extends RiscoCPBaseDetectors {
    constructor (log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.Door, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.CurrentPosition)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusTampered)
            .on('get', this.getCurrentTamperState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusFault)
            .on('get', this.getCurrentFaultState.bind(this));
        this.sPrefix = 'Door Contact';
    }

    DefineAccessoryVariable() {
        this.mainCharac = this.Characteristic.CurrentPosition;
        this.secondCharac = this.Characteristic.TargetPosition;
        this.ActiveValue = 100;
        this.InactiveValue = 0;
        this.ActiveStr = 'open';
        this.InactiveStr = 'closed';
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.CurrentPosition)
            .removeListener('get', this.getCurrentState);
    }
}

class RiscoCPCWindow extends RiscoCPBaseDetectors {
    constructor(log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.Window, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.CurrentPosition)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusTampered)
            .on('get', this.getCurrentTamperState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusFault)
            .on('get', this.getCurrentFaultState.bind(this));        
        this.sPrefix = 'Window Contact';
    }

    DefineAccessoryVariable() {
        this.mainCharac = this.Characteristic.CurrentPosition;
        this.secondCharac = this.Characteristic.TargetPosition;
        this.ActiveValue = 100;
        this.InactiveValue = 0;
        this.ActiveStr = 'open';
        this.InactiveStr = 'closed';
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.CurrentPosition)
            .removeListener('get', this.getCurrentState);
    }
}

class RiscoCPCContactSensor extends RiscoCPBaseDetectors {
    constructor(log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.ContactSensor, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.ContactSensorState)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusTampered)
            .on('get', this.getCurrentTamperState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusFault)
            .on('get', this.getCurrentFaultState.bind(this));
        this.sPrefix = 'Contact Sensor';
    }

    DefineAccessoryVariable() {
        this.mainCharac = this.Characteristic.ContactSensorState;
        this.ActiveValue = true;
        this.InactiveValue = false;
        this.ActiveStr = 'Active';
        this.InactiveStr = 'Inactive';
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.ContactSensorState)
            .removeListener('get', this.getCurrentState);
    }
}

class RiscoCPCVibrateSensor extends RiscoCPBaseDetectors {
    constructor(log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.MotionSensor, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.MotionDetected)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusTampered)
            .on('get', this.getCurrentTamperState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusFault)
            .on('get', this.getCurrentFaultState.bind(this));
        this.sPrefix = 'Vibrate Sensor';
    }

    DefineAccessoryVariable() {
        this.mainCharac = this.Characteristic.MotionDetected;
        this.ActiveValue = true;
        this.InactiveValue = false;
        this.ActiveStr = 'Active';
        this.InactiveStr = 'Inactive';
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.MotionDetected)
            .removeListener('get', this.getCurrentState);
    }
}

class RiscoCPCSmokeSensor extends RiscoCPBaseDetectors {
    constructor (log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.SmokeSensor, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.SmokeDetected)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusTampered)
            .on('get', this.getCurrentTamperState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusFault)
            .on('get', this.getCurrentFaultState.bind(this));
        this.sPrefix = 'Smoke Sensor';
    }

    DefineAccessoryVariable() {
        this.mainCharac = this.Characteristic.SmokeDetected;
        this.ActiveValue = 1;
        this.InactiveValue = 0;
        this.ActiveStr = 'Active';
        this.InactiveStr = 'Inactive';
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.SmokeDetected)
            .removeListener('get', this.getCurrentState);
    }
}

class RiscoCPWaterSensor extends RiscoCPBaseDetectors {
    constructor(log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.LeakSensor, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.LeakDetected)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusTampered)
            .on('get', this.getCurrentTamperState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusFault)
            .on('get', this.getCurrentFaultState.bind(this));
        this.sPrefix = 'Water Sensor';
    }

    DefineAccessoryVariable() {
        this.mainCharac = this.Characteristic.LeakDetected;
        this.ActiveValue = 1;
        this.InactiveValue = 0;
        this.ActiveStr = 'Active';
        this.InactiveStr = 'Inactive';
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.LeakDetected)
            .removeListener('get', this.getCurrentState);
    }
}

class RiscoCPGasSensor extends RiscoCPBaseDetectors {
    constructor(log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.CarbonDioxideSensor, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.CarbonDioxideDetected)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusTampered)
            .on('get', this.getCurrentTamperState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusFault)
            .on('get', this.getCurrentFaultState.bind(this));
        this.sPrefix = 'Gas Sensor';
    }

    DefineAccessoryVariable() {
        this.mainCharac = this.Characteristic.CarbonDioxideDetected;
        this.ActiveValue = 1;
        this.InactiveValue = 0;
        this.ActiveStr = 'Active';
        this.InactiveStr = 'Inactive';
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.CarbonDioxideDetected)
            .removeListener('get', this.getCurrentState);
    }
}

class RiscoCPCoSensor extends RiscoCPBaseDetectors {
    constructor(log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.CarbonMonoxideSensor, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.CarbonMonoxideDetected)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusTampered)
            .on('get', this.getCurrentTamperState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusFault)
            .on('get', this.getCurrentFaultState.bind(this));
        this.sPrefix = 'CO Sensor';
    }

    DefineAccessoryVariable() {
        this.mainCharac = this.Characteristic.CarbonMonoxideDetected;
        this.ActiveValue = 1;
        this.InactiveValue = 0;
        this.ActiveStr = 'Active';
        this.InactiveStr = 'Inactive';
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.CarbonMonoxideDetected)
            .removeListener('get', this.getCurrentState);
    }
}

class RiscoCPTempSensor extends RiscoCPBaseDetectors {
    constructor(log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.TemperatureSensor, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.CurrentTemperature)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusTampered)
            .on('get', this.getCurrentTamperState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.StatusFault)
            .on('get', this.getCurrentFaultState.bind(this));
        this.sPrefix = 'Temperature Sensor';
    }

    DefineAccessoryVariable() {
        this.mainCharac = this.Characteristic.CurrentTemperature;
        if ( this.DeviceInstance.Type == 31) {
            this.ActiveValue = 100;
            this.ActiveStr = 'Hot Temperature';
        } else {
            this.ActiveValue = -50;
            this.ActiveStr = 'Low Temperature';
        }
        this.InactiveValue = 20;
        this.InactiveStr = 'Normal Temperature';
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.CurrentTemperature)
            .removeListener('get', this.getCurrentState);
    }
}


module.exports = {
    RiscoCPDetectors: RiscoCPDetectors,
    RiscoCPCDoor: RiscoCPCDoor,
    RiscoCPCWindow: RiscoCPCWindow,
    RiscoCPCContactSensor: RiscoCPCContactSensor,
    RiscoCPCVibrateSensor: RiscoCPCVibrateSensor,
    RiscoCPCSmokeSensor: RiscoCPCSmokeSensor,
    RiscoCPWaterSensor: RiscoCPWaterSensor,
    RiscoCPGasSensor: RiscoCPGasSensor,
    RiscoCPCoSensor: RiscoCPCoSensor,
    RiscoCPTempSensor: RiscoCPTempSensor,
}