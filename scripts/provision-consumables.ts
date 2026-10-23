import { provisionConsumables } from './consumables-migration';
await provisionConsumables();
console.log(JSON.stringify({ event: 'consumables.provisioned' }));
