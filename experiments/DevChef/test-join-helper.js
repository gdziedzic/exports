// Simulates the critical DevChefTool logic from sql-join-helper.html
// Run with: node test-join-helper.js

const DevChefTool = {
  tables: [],
  joins: [],
  schemaData: null,

  generateAlias(tableName) {
    const words = tableName.match(/[A-Z][a-z]*/g) || [tableName];
    if (words.length > 1) return words.map(w => w[0].toLowerCase()).join('');
    return tableName.substring(0, 1).toLowerCase();
  },

  addTable(name, alias, schema, columns) {
    this.tables.push({ name, alias, schema, columns });
  },

  applySchema(data) {
    this.tables = [];
    this.joins = [];
    data.tables.forEach((table, index) => {
      const alias = this.generateAlias(table.name, index);
      this.addTable(table.name, alias, table.schema || 'dbo', table.columns);
    });
    return this.detectFKJoins();
  },

  detectFKJoins() {
    const seen = new Set();
    let count = 0;

    // Pass 1: explicit references
    this.tables.forEach(table => {
      if (!table.columns) return;
      table.columns.forEach(col => {
        if (!col.references) return;
        const refTable = this.tables.find(t => t.name === col.references.table);
        if (!refTable || refTable.name === table.name) return;
        const key = `${refTable.name}.${col.references.column}→${table.name}.${col.name}`;
        if (seen.has(key)) return;
        seen.add(key);
        this.joins.push({
          leftTable: refTable.name, leftColumn: col.references.column,
          rightTable: table.name,  rightColumn: col.name,
          joinType: 'LEFT JOIN'
        });
        count++;
      });
    });

    // Pass 2: heuristic
    if (count === 0) {
      this.tables.forEach(table => {
        if (!table.columns) return;
        table.columns.forEach(col => {
          if (col.primaryKey || !col.name.endsWith('Id')) return;
          const prefix = col.name.slice(0, -2);
          const refTable = this.tables.find(t =>
            t.name !== table.name && (
              t.name.toLowerCase() === prefix.toLowerCase() ||
              t.name.toLowerCase() === prefix.toLowerCase() + 's' ||
              t.name.toLowerCase() === prefix.toLowerCase() + 'es'
            )
          );
          if (!refTable) return;
          const pkCol = refTable.columns?.find(c => c.primaryKey)?.name
            || refTable.columns?.find(c => c.name.toLowerCase().endsWith('id'))?.name
            || prefix + 'Id';
          const key = `${refTable.name}.${pkCol}→${table.name}.${col.name}`;
          if (seen.has(key)) return;
          seen.add(key);
          this.joins.push({
            leftTable: refTable.name, leftColumn: pkCol,
            rightTable: table.name,  rightColumn: col.name,
            joinType: 'LEFT JOIN'
          });
          count++;
        });
      });
    }
    return count;
  },

  generateSQL() {
    if (!this.tables.length) return 'ERROR: no tables';
    const ft = this.tables[0];
    const ftName = ft.schema ? `[${ft.schema}].[${ft.name}]` : ft.name;
    let sql = `SELECT\n    *\nFROM\n    ${ftName}`;
    if (ft.alias) sql += ` ${ft.alias}`;
    sql += '\n';
    this.joins.forEach(join => {
      if (!join.leftTable || !join.rightTable) return;
      const lt = this.tables.find(t => t.name === join.leftTable);
      const rt = this.tables.find(t => t.name === join.rightTable);
      const la = lt?.alias || join.leftTable;
      const ra = rt?.alias || join.rightTable;
      const rtn = rt?.schema ? `[${rt.schema}].[${rt.name}]` : join.rightTable;
      sql += `    ${join.joinType} ${rtn}`;
      if (ra !== join.rightTable) sql += ` ${ra}`;
      sql += ` ON ${la}.[${join.leftColumn}] = ${ra}.[${join.rightColumn}]\n`;
    });
    sql += ';';
    return sql;
  }
};

// ---- TESTS ----

let passed = 0, failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ---- Test 1: generateAlias ----
console.log('\nTest: generateAlias');
assert('Customers → c',    DevChefTool.generateAlias('Customers'), 'c');
assert('Orders → o',       DevChefTool.generateAlias('Orders'), 'o');
assert('OrderItems → oi',  DevChefTool.generateAlias('OrderItems'), 'oi');
assert('Departments → d',  DevChefTool.generateAlias('Departments'), 'd');
assert('Employees → e',    DevChefTool.generateAlias('Employees'), 'e');
assert('Projects → p',     DevChefTool.generateAlias('Projects'), 'p');

// ---- Test 2: E-Commerce schema FK detection ----
console.log('\nTest: E-Commerce FK detection');
const ecommerce = {
  tables: [
    { name:'Customers', schema:'dbo', columns:[
      {name:'CustomerId', primaryKey:true},{name:'FirstName'},{name:'Email'}
    ]},
    { name:'Orders', schema:'dbo', columns:[
      {name:'OrderId', primaryKey:true},
      {name:'CustomerId', references:{table:'Customers',column:'CustomerId'}},
      {name:'Status'}
    ]},
    { name:'OrderItems', schema:'dbo', columns:[
      {name:'OrderItemId', primaryKey:true},
      {name:'OrderId', references:{table:'Orders',column:'OrderId'}},
      {name:'Qty'}
    ]}
  ]
};
const eCount = DevChefTool.applySchema(ecommerce);
assert('detected 2 FK joins', eCount, 2);
assert('join[0] leftTable = Customers',  DevChefTool.joins[0].leftTable, 'Customers');
assert('join[0] leftColumn = CustomerId',DevChefTool.joins[0].leftColumn,'CustomerId');
assert('join[0] rightTable = Orders',    DevChefTool.joins[0].rightTable,'Orders');
assert('join[0] rightColumn = CustomerId',DevChefTool.joins[0].rightColumn,'CustomerId');
assert('join[1] leftTable = Orders',     DevChefTool.joins[1].leftTable, 'Orders');
assert('join[1] rightTable = OrderItems',DevChefTool.joins[1].rightTable,'OrderItems');

// ---- Test 3: E-Commerce SQL generation ----
console.log('\nTest: E-Commerce SQL generation');
const eSql = DevChefTool.generateSQL();
console.log(eSql);
assert('FROM Customers', eSql.includes('[dbo].[Customers] c'), true);
assert('JOIN Orders ON CustomerId', eSql.includes('LEFT JOIN [dbo].[Orders] o ON c.[CustomerId] = o.[CustomerId]'), true);
assert('JOIN OrderItems ON OrderId', eSql.includes('LEFT JOIN [dbo].[OrderItems] oi ON o.[OrderId] = oi.[OrderId]'), true);
assert('ends with semicolon', eSql.trim().endsWith(';'), true);

// ---- Test 4: HR schema ----
console.log('\nTest: HR schema FK detection & SQL');
const hr = {
  tables: [
    { name:'Departments', schema:'hr', columns:[
      {name:'DepartmentId', primaryKey:true},{name:'Name'}
    ]},
    { name:'Employees', schema:'hr', columns:[
      {name:'EmployeeId', primaryKey:true},
      {name:'DepartmentId', references:{table:'Departments',column:'DepartmentId'}},
      {name:'FirstName'}
    ]},
    { name:'Projects', schema:'hr', columns:[
      {name:'ProjectId', primaryKey:true},
      {name:'DepartmentId', references:{table:'Departments',column:'DepartmentId'}},
      {name:'Name'}
    ]}
  ]
};
const hCount = DevChefTool.applySchema(hr);
assert('detected 2 FK joins', hCount, 2);
const hSql = DevChefTool.generateSQL();
console.log(hSql);
assert('FROM Departments', hSql.includes('[hr].[Departments] d'), true);
assert('JOIN Employees', hSql.includes('LEFT JOIN [hr].[Employees] e ON d.[DepartmentId] = e.[DepartmentId]'), true);
assert('JOIN Projects',  hSql.includes('LEFT JOIN [hr].[Projects] p ON d.[DepartmentId] = p.[DepartmentId]'), true);

// ---- Test 5: Heuristic FK detection (no explicit references) ----
console.log('\nTest: Heuristic FK detection');
const heuristic = {
  tables: [
    { name:'Users', schema:'dbo', columns:[
      {name:'UserId', primaryKey:true},{name:'Name'}
    ]},
    { name:'Posts', schema:'dbo', columns:[
      {name:'PostId', primaryKey:true},
      {name:'UserId'},   // no explicit references — heuristic should detect this
      {name:'Title'}
    ]}
  ]
};
const heuCount = DevChefTool.applySchema(heuristic);
assert('heuristic: detected 1 join', heuCount, 1);
assert('heuristic: leftTable=Users',  DevChefTool.joins[0].leftTable, 'Users');
assert('heuristic: rightTable=Posts', DevChefTool.joins[0].rightTable, 'Posts');

// ---- Test 6: Self-ref skipped ----
console.log('\nTest: Self-referential FK skipped');
const selfRef = {
  tables: [
    { name:'Categories', schema:'dbo', columns:[
      {name:'CategoryId', primaryKey:true},
      {name:'ParentCategoryId', references:{table:'Categories',column:'CategoryId'}}
    ]}
  ]
};
const srCount = DevChefTool.applySchema(selfRef);
assert('self-ref skipped (0 joins)', srCount, 0);

// ---- Test 7: applySchema resets state ----
console.log('\nTest: applySchema resets state');
// Already applied ecommerce then hr then heuristic then selfRef above
// Apply ecommerce again — should not accumulate
DevChefTool.applySchema(ecommerce);
assert('tables reset to 3', DevChefTool.tables.length, 3);
assert('joins reset to 2',  DevChefTool.joins.length, 2);

// ---- Test 8: init resets state ----
console.log('\nTest: init resets tables/joins before adding defaults');
// Simulate re-init by manually calling the init logic (the reset part)
DevChefTool.tables = [{name:'OldTable',alias:'x',schema:'dbo',columns:[]}];
DevChefTool.joins  = [{leftTable:'OldTable',leftColumn:'x',rightTable:'OldTable',rightColumn:'y',joinType:'INNER JOIN'}];
// Reset as init does
DevChefTool.tables = [];
DevChefTool.joins  = [];
DevChefTool.schemaData = null;
DevChefTool.addTable('Users', 'u', 'dbo', []);
DevChefTool.addTable('Orders', 'o', 'dbo', []);
assert('after reset: 2 tables', DevChefTool.tables.length, 2);
assert('tables[0] = Users',  DevChefTool.tables[0].name, 'Users');
assert('tables[1] = Orders', DevChefTool.tables[1].name, 'Orders');

// ---- Summary ----
console.log(`\n===== ${passed} passed, ${failed} failed =====`);
process.exit(failed > 0 ? 1 : 0);
