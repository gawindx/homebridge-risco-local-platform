'use strict';

class RiscoCPCombDevices {
    constructor(log, accConfig, api, accessory) {
        this.ClassName = this.constructor.name;
        this.log = log;
        this.name = accConfig.context.name;
        this.RiscoSession = accConfig.RiscoSession;
        this.RiscoCombinedId = accConfig.context.Id;
        this.RiscoInId = accConfig.context.InId;
        this.RiscoOutId = accConfig.context.OutId;
        this.InDeviceInstance = accConfig.context.InObj;
        this.OutDeviceInstance = accConfig.context.OutObj;
        this.IsWireless = accConfig.context.IsWireless;
        this.PulseDelay = this.OutDeviceInstance.PulseDelay;
        this.accessory = accessory;
        this.api = api;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        this.SetServicesAccessory();
        this.SetExcludeServicesAccessory();
        this.DefineAccessoryVariable();

        this.CombinedReady = false;
        this.IsPulsed = false;

        // Fix Initial States
        this.mainService.updateCharacteristic(this.CharacCurrentPos, (this.InDeviceInstance.Open) ? this.InActiveValue : this.InInactiveValue);
        this.ExcludeService.updateCharacteristic(this.Characteristic.On, this.InDeviceInstance.Bypass);
        this.mainService.updateCharacteristic(this.CharacTargetPos, this.OutDeviceInstance.Active);
        this.mainService.updateCharacteristic(this.CharacCurrentPos, this.OutDeviceInstance.Active);

        //avoid maxlistener warning
        const MaxApiListeners = this.api.getMaxListeners();
        const ActualListeners = this.api.listenerCount('shutdown');
        this.log.debug(`Api Event Shutdown : \nActual Listener :${this.api.listenerCount('shutdown')} for Maximum :${MaxApiListeners}`);
        if (ActualListeners >= MaxApiListeners) {
            //give one more for other process
            this.api.setMaxListeners(ActualListeners + 2);
            this.log.debug(`Max Listener Exceeded. Set To :${(ActualListeners + 2)}`);
        }

        this.api.once('shutdown', () => {
            this.log.debug(`Cleaning Before Exit.\nRemove All Listeners for ${this.name}`);
            this.mainService
                .getCharacteristic(this.Characteristic.On)
                .removeListener('get', this.getCurrentState)
                .removeListener('set', this.setTargetState);
        });

        this.OutDeviceInstance.on('Actived', () => {
            this.mainService.updateCharacteristic(this.CharacTargetPos, this.OutDeviceInstance.Active);
        });
        this.OutDeviceInstance.on('Deactived', () => {
            this.mainService.updateCharacteristic(this.CharacTargetPos, this.OutDeviceInstance.Active);
        });
        this.OutDeviceInstance.on('Pulsed', () => {
            this.mainService.updateCharacteristic(this.CharacTargetPos, true);
            setTimeout(this.ResetPulseSwitchState, this.PulseDelay, this);
        });

        this.InDeviceInstance.on('Open', () => {
            this.mainService.updateCharacteristic(this.CharacCurrentPos, this.InActiveValue);
        });
        this.InDeviceInstance.on('Closed', () => {
            this.mainService.updateCharacteristic(this.CharacCurrentPos, this.InInactiveValue);
        });
        this.InDeviceInstance.on('Bypassed', () => {
            this.ExcludeService.updateCharacteristic(this.Characteristic.On, this.InDeviceInstance.Bypass);
        });
        this.InDeviceInstance.on('UnBypassed', () => {
            this.ExcludeService.updateCharacteristic(this.Characteristic.On, this.InDeviceInstance.Bypass);
        });
        this.InDeviceInstance.on('Tamper', () => {
            this.mainService.updateCharacteristic(this.Characteristic.StatusTampered, ((this.InDeviceInstance.Tamper) ? 1 : 0));
        });
        this.InDeviceInstance.on('Hold', () => {
            this.mainService.updateCharacteristic(this.Characteristic.StatusTampered, ((this.InDeviceInstance.Tamper) ? 1 : 0));
        });

        this.InDeviceInstance.on('Trouble', () => {
            let DeviceFault = this.InDeviceInstance.Trouble || this.InDeviceInstance.Lost || this.InDeviceInstance.CommTrouble || this.InDeviceInstance.SoakTest;
            this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((DeviceFault) ? 1 : 0));
        });
        this.InDeviceInstance.on('Sureness', () => {
            let DeviceFault = this.InDeviceInstance.Trouble || this.InDeviceInstance.Lost || this.InDeviceInstance.CommTrouble || this.InDeviceInstance.SoakTest;
            this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((DeviceFault) ? 1 : 0));
        });
        this.InDeviceInstance.on('CommTrouble', () => {
            let DeviceFault = this.InDeviceInstance.Trouble || this.InDeviceInstance.Lost || this.InDeviceInstance.CommTrouble || this.InDeviceInstance.SoakTest;
            this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((DeviceFault) ? 1 : 0));
        });
        this.InDeviceInstance.on('CommOk', () => {
            let DeviceFault = this.InDeviceInstance.Trouble || this.InDeviceInstance.Lost || this.InDeviceInstance.CommTrouble || this.InDeviceInstance.SoakTest;
            this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((DeviceFault) ? 1 : 0));
        });
        
        if (this.IsWireless) {
            this.InDeviceInstance.on('LowBattery', () => {
                this.BatteryService.updateCharacteristic(this.Characteristic.StatusLowBattery, 10);
            });
            this.InDeviceInstance.on('BatteryOk', () => {
                this.BatteryService.updateCharacteristic(this.Characteristic.StatusLowBattery, 100);
            });
        }
    }

    SetExcludeServicesAccessory() {
        this.log.debug(`Adding Exclude Switch to ${this.name}`);
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
            this.log.debug(`${this.sPrefix} "${this.name}" MotionDetected: ${((this.InDeviceInstance.Open) ? this.InActiveStr : this.InInactiveStr)}`);
            callback(null, (this.InDeviceInstance.Open) ? this.InActiveValue : this.InInactiveValue);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            callback(err, (this.InDeviceInstance.Open) ? this.InActiveValue : this.InInactiveValue);
            return;
        }
    }

    async setTargetState(state, callback) {
        try {
            if (this.OutDeviceInstance.Pulsed) {
                if (this.IsPulsed) {
                    this.log.debug('Pulse switch is already pulsed');
                    this.IsPulsed = false;
                    typeof callback === 'function' && callback(null);
                } else {
                    this.log.debug('Pulse switch is not already pulsed');
                    this.IsPulsed = true;
                    await this.OutDeviceInstance.ToggleOutput();
                    typeof callback === 'function' && callback(null);
                }
            } else {
                this.log.debug('Not a pulse switch, update it')
                await this.OutDeviceInstance.ToggleOutput();
                this.mainService.updateCharacteristic(this.CharacTargetPos, this.OutDeviceInstance.Active);
                typeof callback === 'function' && callback(null);
            }
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            this.mainService.updateCharacteristic(this.CharacTargetPos, this.OutDeviceInstance.Active);
            callback(err);
            return;
        }
    }

    async getTargetState(callback) {
    try {
            callback(null, (this.InDeviceInstance.Open) ? this.InActiveValue : this.InInactiveValue);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            this.mainService.updateCharacteristic(this.CharacTargetPos, TState);
            callback(err);
            return;
        }
    }

    async getCurrentExcludeState(callback) {
        try {
            this.log.debug(`${this.sPrefix} "${this.name}" Exclude State : (${this.InDeviceInstance.Bypass}) => ${(this.InDeviceInstance.Bypass) ? 'Bypassed': 'Not Bypassed'}`);
            callback(null, this.InDeviceInstance.Bypass);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            callback(err, this.InDeviceInstance.Bypass);
            return;
        }
    }

    async setCurrentExcludeState(state, callback) {
        try {
            await this.InDeviceInstance.ToggleBypass();
            this.ExcludeService.updateCharacteristic(this.Characteristic.On, this.InDeviceInstance.Bypass);
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            this.ExcludeService.updateCharacteristic(this.Characteristic.On, this.InDeviceInstance.Bypass);
            callback(err);
            return;
        }
    }

    async ResetPulseSwitchState(self) {
        self.log.debug(`Reset Pulse Switch State to ${self.OutDeviceInstance.Active}`);
        self.mainService.updateCharacteristic(self.CharacTargetPos, self.OutDeviceInstance.Active);
        self.IsPulsed = false;
    }

    getFunctionName() {
        return (new Error()).stack.split('\n')[2].trim().match(/at [a-zA-Z]+\.([^ ]+)/)[1]
    }
}

class RiscoCPCombDoor extends RiscoCPCombDevices {
    constructor (log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.Door, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.CurrentPosition)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.TargetPosition)
            .on('get', this.getTargetState.bind(this))
            .on('set', this.setTargetState.bind(this));
        this.sPrefix = 'Door Opener';
    }

    DefineAccessoryVariable() {
        this.TargetOpenStateValue = 30;
        this.InActiveValue = 100;
        this.InInactiveValue = 0;
        this.InActiveStr = 'Open';
        this.InInactiveStr = 'Closed';
        this.ServiceMain = this.Service.Door;
        this.CharacCurrentPos = this.Characteristic.CurrentPosition;
        this.CharacTargetPos = this.Characteristic.TargetPosition;
        this.OpeningValue = 60;
        this.ClosingValue = 40;
        this.StoppedValue = 50;
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.CurrentPosition)
            .removeListener('get', this.getCurrentState);
        this.mainService
            .getCharacteristic(this.Characteristic.TargetPosition)
            .removeListener('get', this.getTargetState)
            .removeListener('set', this.setTargetState);
    }
}

class RiscoCPCombWindow extends RiscoCPCombDevices {
    constructor (log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.Window, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.CurrentPosition)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.TargetPosition)
            .on('get', this.getTargetState.bind(this))
            .on('set', this.setTargetState.bind(this));
        this.sPrefix = 'Window Opener';
    }

    DefineAccessoryVariable() {
        this.TargetOpenStateValue = 30;
        this.InActiveValue = 100;
        this.InInactiveValue = 0;
        this.InActiveStr = 'Open';
        this.InInactiveStr = 'Closed';
        this.ServiceMain = this.Service.Window;
        this.CharacCurrentPos = this.Characteristic.CurrentPosition;
        this.CharacTargetPos = this.Characteristic.TargetPosition;
        this.OpeningValue = 60;
        this.ClosingValue = 40;
        this.StoppedValue = 50;
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.CurrentPosition)
            .removeListener('get', this.getCurrentState);
        this.mainService
            .getCharacteristic(this.Characteristic.TargetPosition)
            .removeListener('get', this.getTargetState)
            .removeListener('set', this.setTargetState);
    }
}

class RiscoCPCombGarageDoor extends RiscoCPCombDevices {
    constructor (log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
    }

    SetServicesAccessory() {
        this.mainService = this.accessory.getService(this.Service.GarageDoorOpener, this.accessory.displayName);
        this.mainService
            .getCharacteristic(this.Characteristic.CurrentDoorState)
            .on('get', this.getCurrentState.bind(this));
        this.mainService
            .getCharacteristic(this.Characteristic.TargetDoorState)
            .on('get', this.getTargetState.bind(this))
            .on('set', this.setTargetState.bind(this));
        this.sPrefix = 'Garage Door Opener';
    }

    DefineAccessoryVariable() {
        this.TargetOpenStateValue = 0;
        this.InActiveValue = 0;
        this.InInactiveValue = 1;
        this.InActiveStr = 'Open';
        this.InInactiveStr = 'Closed';
        this.ServiceMain = this.Service.GarageDoorOpener;
        this.CharacCurrentPos = this.Characteristic.CurrentDoorState;
        this.CharacTargetPos = this.Characteristic.TargetDoorState;
        this.OpeningValue = 2;
        this.ClosingValue = 3;
        this.StoppedValue = 4;
    }

    removemainListeners() {
        this.mainService
            .getCharacteristic(this.Characteristic.CurrentDoorState)
            .removeListener('get', this.getCurrentState);
        this.mainService(this.Characteristic.TargetDoorState)
            .removeListener('get', this.getTargetState)
            .removeListener('set', this.setTargetState);
    }
}

module.exports = {
    RiscoCPCombDoor: RiscoCPCombDoor,
    RiscoCPCombWindow: RiscoCPCombWindow,
    RiscoCPCombGarageDoor: RiscoCPCombGarageDoor

}