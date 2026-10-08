import { Option } from '@nx-console/shared-schema';
import { env, QuickPickItem, window } from 'vscode';

class CliTaskFlagQuickPickItem implements QuickPickItem {
  constructor(
    readonly flagName: string,
    readonly detail = '',
    readonly option: Option,
    readonly label: string,
    readonly description?: string,
  ) {}
}

class ExecuteCommandQuickPickItem implements QuickPickItem {
  type = 'execute';
  picked = true;
  alwaysShow = true;

  constructor(
    readonly label: string,
    readonly description?: string,
  ) {}
}

class CopyCommandQuickPickItem implements QuickPickItem {
  type = 'copy';
  alwaysShow = true;

  constructor(
    readonly label: string,
    readonly description?: string,
  ) {}
}

class CustomOptionsQuickPickItem implements QuickPickItem {
  type = 'custom';
  alwaysShow = true;

  constructor(
    readonly label: string,
    readonly description?: string,
  ) {}
}

/**
 * Returns undefined if the user wants to cancel the command.
 * Returns an empty array to run the command without flags.
 * Returns an array populated with flags if the user provides them.
 */
export async function selectFlags(
  command: string,
  options: Option[],
  userSetFlags: { [key: string]: string } = {},
  customOptions?: string,
): Promise<string[] | undefined> {
  const flagArray = Object.entries(userSetFlags).map(
    ([flagName, value]) => `--${flagName}=${value}`,
  );
  if (customOptions) {
    flagArray.push(customOptions);
  }

  const currentCommand = `nx ${command} ${flagArray.join(' ')}`.trim();

  const selection = await promptForFlagToSet(
    currentCommand,
    options.filter((option) => !userSetFlags[option.name]),
  );

  if (selection.copy) {
    await env.clipboard.writeText(currentCommand);
    window.showInformationMessage(`Copied "${currentCommand}" to clipboard`);
    return undefined;
  }

  if (selection.execute !== undefined) {
    return selection.execute ? flagArray : undefined;
  }

  if (selection.flag) {
    const flagValue = await promptForFlagValue(selection.flag);

    if (flagValue && flagValue.length > 0) {
      userSetFlags[selection.flag.flagName] = flagValue;
    } else {
      delete userSetFlags[selection.flag.flagName];
    }
  } else if (selection.customOptions) {
    const customOptionResult = await promptForCustomOptions(customOptions);
    if (customOptionResult) {
      customOptions = customOptionResult;
    }
  }

  return selectFlags(command, options, userSetFlags, customOptions);
}

async function promptForFlagToSet(
  currentCommand: string,
  options: Option[],
): Promise<{
  execute?: boolean;
  copy?: boolean;
  flag?: CliTaskFlagQuickPickItem;
  customOptions?: boolean;
}> {
  const flagItems: Array<
    | CliTaskFlagQuickPickItem
    | ExecuteCommandQuickPickItem
    | CopyCommandQuickPickItem
    | CustomOptionsQuickPickItem
  > = [
    new ExecuteCommandQuickPickItem(`Execute: ${currentCommand}`),
    new CopyCommandQuickPickItem(`Copy: ${currentCommand}`),
    ...options.map((option) => {
      const detail =
        option.description ??
        (Array.isArray(option.type) ? option.type?.[0] : option.type);
      return new CliTaskFlagQuickPickItem(
        option.name,
        detail,
        option,
        `${option.name}`,
        option.isRequired ? 'required' : undefined,
      );
    }),
    new CustomOptionsQuickPickItem(
      'Custom Options',
      'Add any additional command text.',
    ),
  ];

  const selection = await window.showQuickPick(flagItems, {
    placeHolder: 'Execute command, copy it, or set flags',
  });

  if (!selection) {
    return { execute: false };
  }

  const flagSelected = Boolean((selection as CliTaskFlagQuickPickItem).option);
  if (!flagSelected) {
    if ((selection as CustomOptionsQuickPickItem).type === 'custom') {
      return { customOptions: true };
    } else if ((selection as CopyCommandQuickPickItem).type === 'copy') {
      return { copy: true };
    } else {
      return { execute: true };
    }
  } else {
    return {
      flag: selection as CliTaskFlagQuickPickItem,
    };
  }
}

function promptForFlagValue(flagToSet: CliTaskFlagQuickPickItem) {
  const placeHolder = `--${flagToSet.flagName}=...`;
  if (flagToSet.option.type === 'boolean') {
    return window.showQuickPick(['true', 'false'], {
      placeHolder,
    });
  } else if (flagToSet.option.enum && flagToSet.option.enum.length) {
    return window.showQuickPick([...flagToSet.option.enum.map(String)], {
      placeHolder,
      canPickMany: flagToSet.option.type === 'array',
    });
  } else {
    return window.showInputBox({
      placeHolder,
    });
  }
}

function promptForCustomOptions(oldCustomOptions?: string) {
  return window.showInputBox({
    value: oldCustomOptions,
    placeHolder: 'Enter any additional command text.',
  });
}
