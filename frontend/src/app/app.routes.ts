import { Routes } from '@angular/router';
import { DocumentIndexComponent } from './document-index/document-index.component';
import { DocumentViewComponent } from './document-view/document-view.component';

export const routes: Routes = [
  { path: '', component: DocumentIndexComponent },
  { path: 'doc/:filename', component: DocumentViewComponent },
  { path: '**', redirectTo: '' },
];
