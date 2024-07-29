import { provideTransloco, TranslocoModule } from '@jsverse/transloco';
import { NgModule } from '@angular/core';
import { TranslocoHttpLoader } from './transloco-loader';
import { environment } from '../environments/environment';

@NgModule({
  exports: [ TranslocoModule ],
  providers: [
      provideTransloco({
        config: {
          availableLangs: [
            { id: 'en', label: 'English' },
            { id: 'de', label: 'Deutsch' },
            { id: 'fr', label: 'Français' },
            { id: 'pt-br', label: 'Portuguese (Brazil)' }
          ],
          defaultLang: 'en',
          fallbackLang: 'en',
          missingHandler: {
            // It will use the first language set in the `fallbackLang` property
            useFallbackTranslation: true
          },
          // Remove this option if your application doesn't support changing language in runtime.
          reRenderOnLangChange: true,
          prodMode: environment.production,
        },
        loader: TranslocoHttpLoader
      }),
  ],
})
export class TranslocoRootModule {}
