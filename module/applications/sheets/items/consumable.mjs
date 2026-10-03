import DHBaseItemSheet from '../api/base-item.mjs';

export default class ConsumableSheet extends DHBaseItemSheet {
    /**@inheritdoc */
    static DEFAULT_OPTIONS = {
        classes: ['consumable'],
        position: { width: 550 }
    };

    /**@override */
    static PARTS = {
        header: { template: 'systems/daggerheart-ja/templates/sheets/items/consumable/header.hbs' },
        tabs: { template: 'systems/daggerheart-ja/templates/sheets/global/tabs/tab-navigation.hbs' },
        description: { 
            template: 'systems/daggerheart-ja/templates/sheets/global/tabs/tab-description.hbs',
            scrollable: ['.description-section']
        },
        actions: {
            template: 'systems/daggerheart-ja/templates/sheets/global/tabs/tab-actions.hbs',
            scrollable: ['']
        },
        settings: {
            template: 'systems/daggerheart-ja/templates/sheets/items/consumable/settings.hbs',
            scrollable: ['']
        },
        effects: {
            template: 'systems/daggerheart-ja/templates/sheets/global/tabs/tab-effects.hbs',
            scrollable: ['']
        }
    };
}
