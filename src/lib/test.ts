type UnionToIntersection<U> =
    (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

type AddParameters<ListenersT, EventT> =
    ListenersT extends (...args: infer ArgsT) => void
        ? (event: EventT, ...args: ArgsT) => Promise<boolean>
        : never;

type EmitSignatures<ListenersT> =
    { [EventT in keyof ListenersT]: AddParameters<ListenersT[EventT], EventT> };
type EmitAll<ListenersT> = UnionToIntersection<EmitSignatures<ListenersT>[keyof ListenersT]>

type OnSignatures<ListenersT, ReturnT> =
    { [EventT in keyof ListenersT]: (event: EventT, listener: ListenersT[EventT]) => ReturnT };
type OnAll<ListenersT, ReturnT> =
    UnionToIntersection<OnSignatures<ListenersT, ReturnT>[keyof ListenersT]>;

type EventEmitter<ListenersT> = EmitterInterface<ListenersT>;

export interface EmitterInterface<ListenersT>
{
    emit: EmitAll<ListenersT>;
    on: OnAll<ListenersT, this> & {__source: ListenersT}; // do not use __source, just here to allow EventTypes to work
}

type EventTypes<T> = T extends EventEmitter<infer U> ? U : never;

/////////////////////////////////////////////////////////////////////////////////////////////

interface VehicleEvents {
  accelerate(acceleration: number): void;
  brake(deceleration: number): void;
}

interface BusEvents extends VehicleEvents {
  doorStateChange(front: boolean, middle: boolean, rear: boolean): void
}

interface Vehicle extends EventEmitter<VehicleEvents> {}

class Vehicle {
  public constructor() {
    this.on('brake', () => this.flashBrakeLights()); //ok 
  }

  public flashBrakeLights(): void { }

  public hitTheGas(strength: number): void { this.emit('accelerate', strength * 42); } // ok

}

type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>
interface Bus extends EventEmitter<BusEvents> { }


function extendEmitter<TBaseCtor extends new (...a: any[])=> any>(ctor: TBaseCtor){
  return function<TEvents extends EventTypes<InstanceType<TBaseCtor>>>(){
    return ctor as (new (...a: ConstructorParameters<TBaseCtor>) => Omit<InstanceType<TBaseCtor>, 'on' | 'emit'> & EventEmitter<TEvents>)
  }
}

class Bus extends extendEmitter(Vehicle)<BusEvents>() {
  public doorState: [boolean, boolean, boolean] = [false, false, false];

  public constructor() {
    super();
    this.on('accelerate', () => {
      this.door(0, false);
      this.door(1, false);
      this.door(2, false);
    });
  }

  public door(index: number, state: boolean): void {
    this.doorState[index] = state;
    this.emit('doorStateChange', ...this.doorState);
  }

}

export const bus = new Bus();
