import { bold, red } from '@angular-devkit/core/src/terminal';
import {
  chain,
  Rule,
  SchematicContext,
  SchematicsException,
  Tree
} from '@angular-devkit/schematics';
import {
  addModuleImportToRootModule,
  getProjectFromWorkspace,
  getProjectMainFile,
  hasNgModuleImport
} from '@angular/cdk/schematics';
import {
  getSourceNodes,
  insertImport,
  isImported
} from '@schematics/angular/utility/ast-utils';
import { InsertChange } from '@schematics/angular/utility/change';
import { getWorkspace } from '@schematics/angular/utility/config';
import { getAppModulePath } from '@schematics/angular/utility/ng-ast-utils';
import { SourceFile } from 'typescript';
import { Schema } from './schema';
import { getProjectEnvironmentFile } from '../util/project-environment-file';
import { ts } from '../util/version-agnostic-typescript';

export default function(options: Schema): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    return chain([
      addEnvironmentConfig(options),
      importEnvironemntIntoRootModule(options),
      addAngularFireModule(options)
    ])(tree, _context);
  };
}

function addEnvironmentConfig(options: Schema): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const workspace = getWorkspace(tree);
    const project = getProjectFromWorkspace(workspace, options.project);
    const envPath = getProjectEnvironmentFile(project);

    // verify environment.ts file exists
    if (!envPath) {
      return context.logger.warn(
        `❌ Could not find environment file: "${envPath}". Skipping firebase configuration.`
      );
    }

    // firebase config to add to environment.ts file
    const insertion =
      ',\n' +
      `  firebase: {\n` +
      `    apiKey: '${options.apiKey}',\n` +
      `    authDomain: '${options.authDomain}',\n` +
      `    databaseURL: '${options.databaseURL}',\n` +
      `    projectId: '${options.projectId}',\n` +
      `    storageBucket: '${options.storageBucket}',\n` +
      `    messagingSenderId: '${options.messagingSenderId}',\n` +
      `    appId: '${options.appId}',\n` +
      `  }`;
    const sourceFile = readIntoSourceFile(tree, envPath);

    // verify firebase config does not already exist
    const sourceFileText = sourceFile.getText();
    if (sourceFileText.includes(insertion)) {
      return;
    }

    // get the array of top-level Node objects in the AST from the SourceFile
    const nodes = getSourceNodes(sourceFile as any);
    const start = nodes.find(
      node => node.kind === ts.SyntaxKind.OpenBraceToken
    )!;
    const end = nodes.find(
      node => node.kind === ts.SyntaxKind.CloseBraceToken,
      start.end
    )!;

    const recorder = tree.beginUpdate(envPath);
    recorder.insertLeft(end.pos, insertion);
    tree.commitUpdate(recorder);

    context.logger.info('✅️ Environment configuration');
    return tree;
  };
}

function addAngularFireModule(options: Schema): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const MODULE_NAME = 'AngularFireModule.initializeApp(environment.firebase)';
    const workspace = getWorkspace(tree);
    const project = getProjectFromWorkspace(workspace, options.project);
    const appModulePath = getAppModulePath(tree, getProjectMainFile(project));

    // verify module has not already been imported
    if (hasNgModuleImport(tree, appModulePath, MODULE_NAME)) {
      return console.warn(
        red(
          `Could not import "${bold(MODULE_NAME)}" because "${bold(
            MODULE_NAME
          )}" is already imported.`
        )
      );
    }

    // add NgModule to root NgModule imports
    addModuleImportToRootModule(tree, MODULE_NAME, '@angular/fire', project);

    context.logger.info('✅️ Import AngularFireModule into root module');
    return tree;
  };
}

function importEnvironemntIntoRootModule(options: Schema): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const IMPORT_IDENTIFIER = 'environment';
    const workspace = getWorkspace(tree);
    const project = getProjectFromWorkspace(workspace, options.project);
    const appModulePath = getAppModulePath(tree, getProjectMainFile(project));
    const envPath = getProjectEnvironmentFile(project);
    const sourceFile = readIntoSourceFile(tree, appModulePath);

    if (isImported(sourceFile as any, IMPORT_IDENTIFIER, envPath)) {
      context.logger.info(
        '✅️ The environment is already imported in the root module'
      );
      return tree;
    }

    const change = insertImport(
      sourceFile as any,
      appModulePath,
      IMPORT_IDENTIFIER,
      envPath.replace(/\.ts$/, '')
    ) as InsertChange;

    const recorder = tree.beginUpdate(appModulePath);
    recorder.insertLeft(change.pos, change.toAdd);
    tree.commitUpdate(recorder);

    context.logger.info('✅️ Import environment into root module');
    return tree;
  };
}

function readIntoSourceFile(host: Tree, fileName: string): SourceFile {
  const buffer = host.read(fileName);
  if (buffer === null) {
    throw new SchematicsException(`File ${fileName} does not exist.`);
  }

  return ts.createSourceFile(
    fileName,
    buffer.toString('utf-8'),
    ts.ScriptTarget.Latest,
    true
  );
}
