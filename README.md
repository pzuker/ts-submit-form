In order for this project to work, needs fix the below dependencies

{
  "extends": "@tsconfig/strictest/tsconfig.json",
  "exclude": [
    "**/dist"
  ],
  "compilerOptions": {
    "target": "es2020" /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */,
    "module": "node16" /* Specify what module code is generated. */,
    "importsNotUsedAsValues": "remove" /* Specify emit/checking behavior for imports that are only used for types. */,
    "esModuleInterop": true /* Emit additional JavaScript to ease support for importing CommonJS modules. This enables 'allowSyntheticDefaultImports' for type compatibility. */,
    "forceConsistentCasingInFileNames": true /* Ensure that casing is correct in imports. */,
    "strict": true /* Enable all strict type-checking options. */,
    "noImplicitAny": false, /* Enable error reporting for expressions and declarations with an implied 'any' type. */
    "noUnusedLocals": false /* Enable error reporting when local variables aren't read. */,
    "noUnusedParameters": false /* Raise an error when a function parameter isn't read. */,
    "noUncheckedIndexedAccess": false /* Add 'undefined' to a type when accessed using an index. */,
    "noPropertyAccessFromIndexSignature": false, /* Enforces using indexed accessors for keys declared using an indexed type. */
    "skipLibCheck": true /* Skip type checking all .d.ts files. */
  }
}
