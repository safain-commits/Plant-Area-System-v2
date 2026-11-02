import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNamingCsv } from '../../packages/consumables-core/src/naming';
const header = 'mmid,common_name,aliases,unit,sap_unit,pack_size,decimal_allowed\r\n';
test('naming CSV handles UTF-8 BOM, quoted commas/quotes, exact decimals and blank unchanged fields', () => {
  const data = parseNamingCsv(
    '\uFEFF' + header + '00012,"Baut ""M16""","baut, BAUT, mur",PCS,SET,2.5,false\r\n00013,,,,,,\r\n',
  );
  assert.equal(data.rows[0].mmid, '00012');
  assert.equal(data.rows[0].patch.commonName, 'Baut "M16"');
  assert.equal(data.rows[0].patch.aliases, 'baut, mur');
  assert.equal(data.rows[0].patch.packSize, '2.500000');
  assert.equal(data.rows[0].patch.decimalAllowed, false);
  assert.deepEqual(data.rows[1].patch, {});
});
test('naming CSV rejects duplicate codes, invalid structure, precision and booleans before apply', () => {
  for (const s of [
    header,
    header + 'a,,,,,,\na,,,,,,',
    header + 'a,"unclosed,,,,,',
    header + 'a,a,b,PCS,SET,0,true',
    header + 'a,a,b,PCS,SET,1.0000001,true',
    header + 'a,a,b,PCS,SET,2,maybe',
    'mmid,name\na,test',
    header + 'a,"name"junk,b,PCS,SET,2,true',
  ])
    assert.throws(() => parseNamingCsv(s));
});
