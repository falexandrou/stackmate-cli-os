import { Flags } from '@oclif/core';

import BaseCommand from '@stackmate/cli/core/commands/base';

class StageCopyCommand extends BaseCommand {
  /**
   * @var {Array} args the command's arguments
   */
  static args = [
    ...BaseCommand.args,
  ];

  /**
   * @var {Object} flags the flags to use in the command
   */
  static flags = {
    ...BaseCommand.flags,
    from: Flags.string({
      char: 'f',
      default: 'production',
      required: true,
      parse: async (v: string) => BaseCommand.parseCommaSeparatedFlag(v),
    }),
    skip: Flags.string({
      char: 's',
      default: '',
      parse: async (v: string) => BaseCommand.parseCommaSeparatedFlag(v),
    }),
  };

  async run(): Promise<any> {
    // console.log(this.parsedFlags);
  }
}

export default StageCopyCommand;
