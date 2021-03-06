import { defineMacro, defineMacroProvider } from 'vite-plugin-macro';
import type { NodePath } from '@babel/traverse';
import type { AssignmentExpression, CallExpression, VariableDeclaration, VariableDeclarator, } from '@babel/types';

const signalMacro = defineMacro('$signal')
  .withCustomType('import { SignalOptions } from \'solid-js/types/reactive/signal\';')
  .withSignature('<T>(value: T, options?: SignalOptions<T> | undefined): T')
  .withHandler(({ path }, { types }, { appendImports }) => {
    const refExpr = path;

    const refID = path.scope.getProgramParent().generateUid('ref');

    appendImports({
      moduleName: 'solid-js',
      exportName: 'createSignal',
      localName: refID,
    });

    const letStmt = path.findParent((p) =>
      p.isVariableDeclaration()
    ) as NodePath<VariableDeclaration>;
    if (!letStmt) {
      refExpr.node.callee = types.identifier(refID);
      return;
    }
    if (letStmt.node.kind !== 'let') {
      throw new Error(`Should use 'let' with $signal() macro.`);
    }
    if (letStmt.node.declarations.length > 1) {
      throw new Error(
        `Please declare one variable in one let statement with $signal() macro.`
      );
    }

    // use findParent to get node path
    const declExpr = refExpr.findParent((p) =>
      p.isVariableDeclarator()
    ) as NodePath<VariableDeclarator>;
    if (!types.isIdentifier(declExpr.node.id)) {
      throw new Error(`Only identifier is allowed with $signal() macro.`);
    }
    refExpr.node.callee = types.identifier(refID);
    letStmt.node.kind = 'const';
    const id = declExpr.node.id.name;

    const idIdentifier = types.identifier(id);
    const pick0 = types.memberExpression(
      idIdentifier,
      types.numericLiteral(0),
      true
    );
    const getSignal = types.callExpression(
      pick0,
      []
    );
    const pick1 = types.memberExpression(
      idIdentifier,
      types.numericLiteral(1),
      true
    );

    const binding = declExpr.scope.getBinding(id);

    binding?.referencePaths.forEach((p) => {
      if ((p.parent as any).callee?.name != '_$insert') {
        p.replaceWith(getSignal);
      } else {
        p.replaceWith(pick0);
      }
    });

    binding?.constantViolations.forEach((p) => {
      switch (p.node.type) {
        case 'UpdateExpression': {
          if (p.node.operator == '++' || p.node.operator == '--') {
            p.replaceWith(types.callExpression(
              pick1,
              [
                types.binaryExpression(
                  p.node.operator[0] as '+' | '-',
                  getSignal,
                  types.numericLiteral(1)
                )
              ]
            ));
          }
          break;
        }
        case 'AssignmentExpression': {
          const node = p.node as AssignmentExpression;
          if (node.operator == '=') {
            p.replaceWith(types.callExpression(
              pick1,
              [node.right],
            ));
          } else {
            p.replaceWith(types.callExpression(
              pick1,
              [
                types.binaryExpression(
                  p.node.operator[0] as any,
                  getSignal,
                  node.right,
                )
              ]
            ));
          }
          break;
        }
      }
    });
  });

const memoMacro = defineMacro('$memo')
  .withCustomType('import { EffectFunction } from \'solid-js/types/reactive/signal\';')
  .withSignature('<T>(value: EffectFunction<T, T>): T')
  .withHandler(({ path }, { types }, { appendImports }) => {
    const refExpr = path;
    const refID = path.scope.getProgramParent().generateUid('memo');

    appendImports({
      moduleName: 'solid-js',
      exportName: 'createMemo',
      localName: refID,
    });


    const letStmt = path.findParent((p) =>
      p.isVariableDeclaration()
    ) as NodePath<VariableDeclaration>;
    if (!letStmt) {
      refExpr.node.callee = types.identifier(refID);
      return;
    }
    if (letStmt.node.kind !== 'let') {
      throw new Error(`Should use 'let' with $memo() macro.`);
    }
    if (letStmt.node.declarations.length > 1) {
      throw new Error(
        `Please declare one variable in one let statement with $memo() macro.`
      );
    }

    // use findParent to get node path
    const declExpr = refExpr.findParent((p) =>
      p.isVariableDeclarator()
    ) as NodePath<VariableDeclarator>;
    if (!types.isIdentifier(declExpr.node.id)) {
      throw new Error(`Only identifier is allowed with $memo() macro.`);
    }
    refExpr.node.callee = types.identifier(refID);
    letStmt.node.kind = 'const';
    const id = declExpr.node.id.name;

    const idIdentifier = types.identifier(id);


    const init = declExpr?.node?.init as CallExpression;
    if (init?.arguments?.[0] && !types.isFunction(init.arguments[0])) {
      init.arguments[0] = types.arrowFunctionExpression(
        [],
        init.arguments[0] as any,
      );
    }

    //ArrowFunctionExpression

    declExpr.scope.getBinding(id)?.referencePaths.forEach((p) => {
      if ((p.parent as any).callee?.name != '_$insert') {
        p.replaceWith(types.callExpression(
          idIdentifier,
          [],
        ));
      }
    });

  });

export function provideRef() {
  return defineMacroProvider({
    id: 'solid-js-macro',
    exports: {
      'solid-js/macro': {
        macros: [signalMacro, memoMacro],
      },
    },
  });
}
