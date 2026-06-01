let _maintenance = false;

export function getMaintenance(): boolean {
  return _maintenance;
}

export function setMaintenance(enable: boolean): void {
  _maintenance = enable;
}
