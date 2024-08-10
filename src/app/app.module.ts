import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ClipboardModule } from 'ngx-clipboard';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { WelcomeComponent } from './welcome/welcome.component';

import { AccountDetailsComponent } from './components/account-details/account-details.component';
import { AccountsComponent } from './components/accounts/accounts.component';
import { AddressBookComponent } from './components/address-book/address-book.component';
import { ChangeRepWidgetComponent } from './components/change-rep-widget/change-rep-widget.component';
import { ConfigureAppComponent } from './components/configure-app/configure-app.component';
import { ConfigureWalletComponent } from './components/configure-wallet/configure-wallet.component';
import { ImportAddressBookComponent } from './components/import-address-book/import-address-book.component';
import { ImportWalletComponent } from './components/import-wallet/import-wallet.component';
import { InstallWidgetComponent } from './components/install-widget/install-widget.component';
import { ManageRepresentativesComponent } from './components/manage-representatives/manage-representatives.component';
import { ManageWalletComponent } from './components/manage-wallet/manage-wallet.component';
import { NanoAccountIdComponent } from './components/helpers/nano-account-id/nano-account-id.component';
import { NanoIdenticonComponent } from './components/helpers/nano-identicon/nano-identicon.component';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { QrModalComponent } from './components/qr-modal/qr-modal.component';
import { QrScanComponent } from './components/qr-scan/qr-scan.component';
import { ReceiveComponent } from './components/receive/receive.component';
import { RemoteSigningComponent } from './components/remote-signing/remote-signing.component';
import { RepresentativesComponent } from './components/representatives/representatives.component';
import { SendComponent } from './components/send/send.component';
import { SignComponent } from './components/sign/sign.component';
import { SweeperComponent } from './components/sweeper/sweeper.component';
import { TransactionDetailsComponent } from './components/transaction-details/transaction-details.component';
import { WalletWidgetComponent } from './components/wallet-widget/wallet-widget.component';

import { AmountSplitPipe } from './pipes/amount-split.pipe';
import { CurrencySymbolPipe } from './pipes/currency-symbol.pipe';
import { FiatPipe } from './pipes/fiat.pipe';
import { RaiPipe } from './pipes/rai.pipe';
import { SqueezePipe } from './pipes/squeeze.pipe';

import { AddressBookService } from './services/address-book.service';
import { ApiService } from './services/api.service';
import { AppSettingsService } from './services/app-settings.service';
import { DesktopService } from './services/desktop.service';
import { LedgerService } from './services/ledger.service';
import { ModalService } from './services/modal.service';
import { MusigService } from './services/musig.service';
import { NanoBlockService } from './services/nano-block.service';
import { NodeService } from './services/node.service';
import { NotificationService } from './services/notification.service';
import { PowService } from './services/pow.service';
import { PriceService } from './services/price.service';
import { RemoteSignService } from './services/remote-sign.service';
import { RepresentativeService } from './services/representative.service';
import { QrModalService } from './services/qr-modal.service';
import { UtilService } from './services/util.service';
import { WalletService } from './services/wallet.service';
import { WebsocketService } from './services/websocket.service';
import { WorkPoolService } from './services/work-pool.service';

// QR code module
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { ServiceWorkerModule } from '@angular/service-worker';
import { TranslocoRootModule } from './transloco-root.module';
import { DeeplinkService, NinjaService } from './services';
import { ConverterComponent } from './components/converter/converter.component';
import { KeygeneratorComponent } from './components/keygenerator/keygenerator.component';
import { MultisigComponent } from './components/multisig/multisig.component';
import { QrGeneratorComponent } from './components/qr-generator/qr-generator.component';
import { NanoTransactionMobileComponent } from './components/helpers/nano-transaction-mobile/nano-transaction-mobile.component';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [
    AppComponent,
    WelcomeComponent,
    ConfigureWalletComponent,
    NotificationsComponent,
    RaiPipe,
    SqueezePipe,
    AccountsComponent,
    SendComponent,
    AddressBookComponent,
    ReceiveComponent,
    WalletWidgetComponent,
    ManageWalletComponent,
    ConfigureAppComponent,
    AccountDetailsComponent,
    TransactionDetailsComponent,
    FiatPipe,
    AmountSplitPipe,
    ImportWalletComponent,
    NanoAccountIdComponent,
    NanoIdenticonComponent,
    ImportAddressBookComponent,
    CurrencySymbolPipe,
    RepresentativesComponent,
    ManageRepresentativesComponent,
    ChangeRepWidgetComponent,
    SweeperComponent,
    QrScanComponent,
    SignComponent,
    RemoteSigningComponent,
    QrModalComponent,
    ConverterComponent,
    QrGeneratorComponent,
    InstallWidgetComponent,
    MultisigComponent,
    KeygeneratorComponent,
    NanoTransactionMobileComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    ClipboardModule,
    ZXingScannerModule,
    NgbModule,
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production && !environment.desktop }),
    TranslocoRootModule,
  ],
  providers: [
    UtilService,
    WalletService,
    NotificationService,
    ApiService,
    AddressBookService,
    ModalService,
    WorkPoolService,
    AppSettingsService,
    WebsocketService,
    NanoBlockService,
    PriceService,
    PowService,
    RepresentativeService,
    NodeService,
    LedgerService,
    DesktopService,
    RemoteSignService,
    NinjaService,
    NgbActiveModal,
    QrModalService,
    DeeplinkService,
    MusigService,
    provideHttpClient()
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
