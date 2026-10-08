jest.mock('vscode', () => ({
  window: {
    showQuickPick: jest.fn(),
    showInformationMessage: jest.fn(),
    showInputBox: jest.fn(),
  },
  env: {
    clipboard: { writeText: jest.fn() },
  },
}));

import { Option } from '@nx-console/shared-schema';
import { env, window } from 'vscode';
import { selectFlags } from './select-flags';

type PickedType = 'execute' | 'copy';

function setupTest({
  command = 'run my-app:build',
  options = [{ name: 'prod', type: 'boolean' } as Option],
  userSetFlags = {} as Record<string, string>,
  pick = 'execute' as PickedType,
} = {}) {
  jest.clearAllMocks();
  const showQuickPick = window.showQuickPick as jest.Mock;
  showQuickPick.mockImplementation(async (items: { type?: string }[]) =>
    items.find((item) => item.type === pick),
  );

  return {
    showQuickPick,
    writeText: env.clipboard.writeText as jest.Mock,
    showInformationMessage: window.showInformationMessage as jest.Mock,
    run: () => selectFlags(command, options, userSetFlags),
  };
}

describe('selectFlags', () => {
  it('shows the copy item directly after the execute item with the full command', async () => {
    const { showQuickPick, run } = setupTest();

    await run();

    const items = showQuickPick.mock.calls[0][0];
    expect(items[0].label).toBe('Execute: nx run my-app:build');
    expect(items[1].type).toBe('copy');
    expect(items[1].label).toBe('Copy: nx run my-app:build');
  });

  it('copies the trimmed command, shows a confirmation and returns undefined', async () => {
    const { writeText, showInformationMessage, run } = setupTest({
      pick: 'copy',
    });

    const result = await run();

    expect(writeText).toHaveBeenCalledWith('nx run my-app:build');
    expect(showInformationMessage).toHaveBeenCalledWith(
      'Copied "nx run my-app:build" to clipboard',
    );
    expect(result).toBeUndefined();
  });

  it('copies the command with preset flags', async () => {
    const { writeText, run } = setupTest({
      command: 'run-many',
      options: [],
      userSetFlags: { target: 'build' },
      pick: 'copy',
    });

    await run();

    expect(writeText).toHaveBeenCalledWith('nx run-many --target=build');
  });

  it('returns the flags without copying when execute is selected', async () => {
    const { writeText, run } = setupTest({
      userSetFlags: { configuration: 'production' },
    });

    const result = await run();

    expect(result).toEqual(['--configuration=production']);
    expect(writeText).not.toHaveBeenCalled();
  });
});
