import type commander from "commander";
import {TopLevelCLIFlags} from "./parseCLI";

// CLIOpts: The expected type generated by parsing the CLI using commander

export interface SubCommandConstructor<Opts> {
    new (ctx: SubCommandContext, ...args: any[]): SubCommand<Opts>;

    // NOTE: This must be static.
    addSubCommandTo(program: commander.Command): commander.Command;
    subCommandName: string;
    description: string;
}
export abstract class SubCommand<Opts> {
    protected abstract ctx: SubCommandContext;

    //abstract makeCompletionParser(program: commander.Command, rawArgs: string[]);
    //abstract cliZodSchema: z.ZodSchema<any>;

    abstract verifyCLI(): Opts | VerifyCLIError;
    abstract callAPI(verifiedOpts: Opts): Promise<ScriptReturn | KnownSafeRunError>;

    async run(): Promise<ScriptReturn | KnownSafeRunError> {
        const optsOrError = this.verifyCLI();
        if (optsOrError instanceof VerifyCLIError) {
            return optsOrError;
        }
        const verifiedOpts = optsOrError;
        return this.callAPI(verifiedOpts);
    }
}

export interface SubCommandContext {
    scriptContext: ScriptContext;
    topLevelCommandOpts: TopLevelCLIFlags;
    subCommandOpts: commander.OptionValues;
    subCommandArgs: string[];
}

export class KnownSafeRunError {
    isKnownSafeRunError = true;
    constructor(public message: string) {}
}

// This is what we'll see if there are errors detectable by commander when we parse the CLI
// (e.g. incorrect syntax, missing required args, etc.)
export class ParseCLIError extends KnownSafeRunError {
    isParseError = true;
}

export class APIKeyNotSetError extends KnownSafeRunError {
    isAPIKeyNotSetError = true;
}

// This is what we'll see if the raw data from the CLI fails verification by zod
// (e.g. incorrect types, values out of range, etc.)
// We could let the API send back an error, but using zod means our data is type-safe,
// gives us more control over values, lowers the chance of leaking sensitive data in errors,
// allows us to provide more helpful error messages, and is just faster.
export class VerifyCLIError extends KnownSafeRunError {
    isVerifyError = true;
}

// Returned for remote runs when the user uses --help/-h or the help command
export interface CLIHelp {helpText: string}

export type ScriptContext = {
    isRemote: false;
} | {
    isRemote: true;
    serverAdminContactInfo: string;
};

export type ScriptReturn = ScriptSuccess | ScriptExit | ScriptFailure;

interface ScriptSuccess {
    status: "success";
    exitCode: 0;
    output: string;
    data: any;
}

interface ScriptExit {
    status: "exit";
    exitCode: 0;
    output: string;
}

type ScriptFailure = ScriptFailureSafe | ScriptFailureUnsafe;

interface ScriptFailureSafe {
    status: "failure_safe";
    exitCode: number;
    stderr: string;
}

interface ScriptFailureUnsafe {
    status: "failure_unsafe";
    exitCode: number;
    stderr: string;
    error?: any;
}