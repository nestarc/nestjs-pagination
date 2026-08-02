const packageJson = require('../../package.json');

describe('package metadata', () => {
  it('publishes discoverability links for npm', () => {
    expect(packageJson.version).toBe('0.3.0');
    expect(packageJson.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/nestarc/nestjs-pagination.git',
    });
    expect(packageJson.homepage).toBe('https://nestarc.dev/packages/pagination/');
    expect(packageJson.bugs).toEqual({
      url: 'https://github.com/nestarc/nestjs-pagination/issues',
    });
  });

  it('declares Prisma 7 compatibility while retaining Prisma 5 and 6 peers', () => {
    expect(packageJson.peerDependencies['@prisma/client']).toBe(
      '^5.0.0 || ^6.0.0 || ^7.0.0',
    );
    expect(packageJson.devDependencies['@prisma/client']).toMatch(/^\^7\./);
    expect(packageJson.devDependencies.prisma).toMatch(/^\^7\./);
  });
});
