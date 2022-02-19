import Operation from '@stackmate/core/operation';

class DeployOperation extends Operation {
  /**
   * Runs the provisioning process
   */
  run() {
    this.provisioner.services = this.services.map(srv => srv.scope('provisionable'));
    this.provisioner.process();
  }
}

export default DeployOperation;
