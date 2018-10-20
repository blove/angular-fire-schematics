import {
  chain,
  Rule,
  SchematicContext,
  Tree
  } from '@angular-devkit/schematics';
import { NodePackageInstallTask, RunSchematicTask } from '@angular-devkit/schematics/tasks';
import { addPackageJsonDependency, NodeDependency, NodeDependencyType } from '@schematics/angular/utility/dependencies';
import { Observable, of } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';
import { Schema } from './schema';
import { getLatestNodeVersion, NpmRegistryPackage } from '../util/npmjs';

export default function(options: Schema): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    return chain([
      addPackageJsonDependencies(),
      installDependencies(),
      setupProject(options)
    ])(tree, _context);
  };
}

function addPackageJsonDependencies(): Rule {
  return (tree: Tree, _context: SchematicContext): Observable<Tree> => {
    return of('firebase', '@angular/fire').pipe(
      concatMap(name => getLatestNodeVersion(name)),
      map((npmRegistryPackage: NpmRegistryPackage) => {
        const nodeDependency: NodeDependency = {
          type: NodeDependencyType.Default,
          name: npmRegistryPackage.name,
          version: npmRegistryPackage.version,
          overwrite: false
        };
        addPackageJsonDependency(tree, nodeDependency);
        _context.logger.debug('✅️ Added dependency');
        return tree;
      })
    );
  };
}

function installDependencies(): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    _context.addTask(new NodePackageInstallTask());
    _context.logger.debug('✅️ Dependencies installed');
    return tree;
  };
}

function setupProject(options: Schema): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const installTaskId = _context.addTask(new NodePackageInstallTask());
    _context.addTask(new RunSchematicTask('ng-add-setup-project', options), [
      installTaskId
    ]);
    return tree;
  };
}
