import { createProject } from '@stackmate/cli/core/generator';

describe('Project generator', () => {
  it('generates a project configuration', () => {
    const config = createProject({
      projectName: 'some-project-name',
      defaultProvider: 'aws',
      defaultRegion: 'eu-central-1',
      secretsProvider: 'aws',
      serviceTypes: ['mysql'],
      stageNames: ['production', 'staging'],
      stateProvider: 'aws',
    });

    expect(config).toMatchObject({
      name: 'some-project-name',
      provider: 'aws',
      region: 'eu-central-1',
      stages: [{
        name: 'production',
        services: [{ type: 'mysql', name: 'mysql-production-database' }],
      }, {
        name: 'staging',
        copy: 'production',
      }],
    });

    expect(config.state).toMatchObject({
      bucket: 'stackmate-state-some-project-name',
    });
  });

  it('applies a numerical suffix when multiple services of the same type are added', () => {
    const config = createProject({
      projectName: 'some-project-name',
      defaultProvider: 'aws',
      defaultRegion: 'eu-central-1',
      secretsProvider: 'aws',
      serviceTypes: ['mysql', 'mysql', 'postgresql', 'mariadb', 'mariadb', 'mariadb'],
      stageNames: ['production', 'staging'],
      stateProvider: 'aws',
    });

    expect(config).toMatchObject({
      stages: [{
        name: 'production',
        services: [
          { type: 'mysql', name: 'mysql-production-database-1' },
          { type: 'mysql', name: 'mysql-production-database-2' },
          { type: 'postgresql', name: 'postgresql-production-database' },
          { type: 'mariadb', name: 'mariadb-production-database-1' },
          { type: 'mariadb', name: 'mariadb-production-database-2' },
          { type: 'mariadb', name: 'mariadb-production-database-3' },
        ],
      }, {
        name: 'staging',
        copy: 'production',
      }],

    })
  });
});