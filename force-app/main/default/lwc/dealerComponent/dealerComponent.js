import { LightningElement, track, api, wire } from 'lwc';
import insertBidders from '@salesforce/apex/getBidderLWC.insertBidders';
import getBidderData from '@salesforce/apex/getBidderLWC.getBidderData';
import updateBidderStatus from '@salesforce/apex/getBidderLWC.updateBidderStatus'; // You'll need to add this Apex method
import STATUS_FIELD from '@salesforce/schema/Project__c.Status__c';
import { notifyRecordUpdateAvailable, getRecord } from 'lightning/uiRecordApi';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import { CurrentPageReference } from 'lightning/navigation';

export default class DealerComponent extends LightningElement {
  @api showActionButtons;
  @api showTable;
  @api showCheckbox;
  @track bidders = [];
  @track newRows = [{ key: 0, Dealer__c: '', Rep_Group_Code__c: '', AQ_Link__c: '', AQ_Link2__c: '' }];
  rowCounter = 1;
  @api recordId;
  @track checkLost = false;
  @track allLost = true;
  @track currentUrl;

  selectedDealerIds = [];

  // @wire(CurrentPageReference)
  //     pageRef({ state }) {
  //       console.log('state', state);
  //         console.log('state.c__recordId', state.c__recordId)
  //         if (state) {
  //             this.recordId = state.c__recordId || null;
  //             console.log('Record ID:', this.recordId);
  //             // if (this.recordId) {
  //             //     // Call your Apex method to fetch bidder data
  //             //     this.getBidderData();
  //             // }
  //         }
  //     }


  @wire(getRecord, { recordId: '$recordId', fields: [STATUS_FIELD] })
  wiredRecord(result) {
    this.wiredRecordResult = result;
    if (result.data) {
      const status = result.data.fields.Status__c.value;
      //console.log('Status===>', status); 
      //console.log('result', JSON.stringify(result));
      if (status === 'Closed Won' || status === 'Closed Lost') {
        this.allLost = false;
        this.showActionButtons = false;
      } else {
        this.allLost = true;
        //this.showActionButtons = false;
      }
      // 🔁 refresh bidder table when project changes
      this.getBidderData();
    }
    if (result.error) {
      console.error('Error fetching record:', result.error);
    }
  }

  extractRecordIdFromPath() {
    const pathSegments = window.location.pathname.split('/');
    console.log('Path Segments:', JSON.stringify(pathSegments));

    // Match any Salesforce Id (standard or custom)
    const sfIdRegex = /^[a-zA-Z0-9]{15,18}$/;

    for (let segment of pathSegments) {
      if (sfIdRegex.test(segment)) {
        console.log('Found Salesforce Id:', segment);
        this.recordId = segment;
        console.log('Record ID:', this.recordId);
        break;
      }
    }
  }


  connectedCallback() {
    this.extractRecordIdFromPath();
    this.getBidderData(); // call your Apex method here

  }

  // Utility: refresh record data
  async refreshStatus() {
    try {
      await refreshApex(this.wiredRecordResult);
    } catch (error) {
      console.error('Error refreshing record:', error);
    }
  }

  //Get status class based on status
  getStatusClass(status) {
    switch ((status || '').toLowerCase()) {
      case 'won':
        return 'status-won';
      case 'lost':
        return 'status-lost';
      case 'open':
      default:
        return 'status-open';
    }
  }
  //Get data from apex class
  getBidderData() {
    // console.log('recordId--->' + this.recordId);
    getBidderData({ projectId: this.recordId })
      .then(result => {
        this.bidders = result
          .filter(record => record?.Id)
          .map(record => {
            const status = record?.Status ?? 'Open';
            const statusClass = this.getStatusClass(status);
            let aqLink = record.AQLink ?? '';
            if (aqLink && !/^https?:\/\//i.test(aqLink)) {
              aqLink = 'https://' + aqLink;
            }

            let aqLinkDisplay = 'Link';
            if (aqLink === '' || aqLink === null || aqLink === 'undefined') {
              aqLinkDisplay = '';
            }

            let aqLink2 = record.AQLink2 ?? '';
            if (aqLink2 && !/^https?:\/\//i.test(aqLink2)) {
              aqLink2 = 'https://' + aqLink2;
            }

            let aqLinkDisplay2 = 'Link';
            if (aqLink2 === '' || aqLink2 === null || aqLink2 === 'undefined') {
              aqLinkDisplay2 = '';
            }

            console.log('link===>' + aqLink2 + 'display===>' + aqLinkDisplay2);


            return {
              id: record.Id,
              Dealer__c: record.AccName,
              Rep_Group_Code__c: record.RepCode ?? '',
              AQ_Link__c: aqLink,
              AQ_Link2__c: aqLink2,
              AQ_Link_Display2__c: aqLinkDisplay2,
              AQ_Link_Display__c: aqLinkDisplay,
              Status__c: status,
              selected: false,
              statusClass: statusClass,
              fullStatusClass: `custom-status-cell ${statusClass}`,
              isWon: status.toLowerCase() === 'won'
            };
          });

        console.log('bidders===>' + JSON.stringify(this.bidders));
        this.selectedDealerIds = [];
      })
      .catch(error => {
        this.showToast('Error', 'Error fetching bidders', 'error');
        console.error('Error fetching bidders:', error);
      });
  }


  //Handle checkbox changes
  handleCheckbox(event) {
    const id = event.target.dataset.id;
    const isChecked = event.target.checked;

    // Update the selected status of the clicked dealer
    this.bidders = this.bidders.map(dealer => {
      if (dealer.id === id) {
        return {
          ...dealer,
          selected: isChecked
          // Optional: Add a UI status like status: isChecked ? 'Selected' : null
        };
      }
      return dealer;
    });

    // Maintain the list of selected dealer IDs
    if (isChecked) {
      this.selectedDealerIds = [...this.selectedDealerIds, id];
    } else {
      this.selectedDealerIds = this.selectedDealerIds.filter(dealerId => dealerId !== id);
    }
  }
  //Handle select all checkbox changes
  handleSelectAll(event) {
    const checked = event.target.checked;
    this.bidders = this.bidders.map(dealer => ({ ...dealer, selected: checked }));

    if (checked) {
      this.selectedDealerIds = this.bidders.map(dealer => dealer.id);
    } else {
      this.selectedDealerIds = [];
    }
  }
  //Mark Won button handle Won Status and other lost
  async handleGreen() {
    if (this.selectedDealerIds.length !== 1) {
      this.showToast('Warning', 'Please select exactly one dealer to mark as Won.', 'warning');
      return;
    }

    const wonId = this.selectedDealerIds[0];
    const lostIds = this.bidders
      .filter(dealer => dealer.id !== wonId)
      .map(dealer => dealer.id);

    try {
      // Mark "Won"
      await updateBidderStatus({ bidderIds: [wonId], newStatus: 'Won', projectId: this.recordId });

      // Mark others "Lost"
      await updateBidderStatus({ bidderIds: lostIds, newStatus: 'Lost', projectId: this.recordId });
      await this.getBidderData(); // Refresh data


      notifyRecordUpdateAvailable([{ recordId: this.recordId }])
        .then(result1 => {
          console.log('result', result1);
        })
        .catch(error => {
          console.log('error', error);
        })

      this.showToast('Success', 'Status updated: 1 Won, others Lost.', 'success');
    } catch (error) {
      this.showToast('Error', 'Error updating statuses.', 'error');
      console.error(error);
    }
  }
  //Mark Lost button handle Lost Status
  handleRed() {
    if (!this.selectedDealerIds.length) {
      this.showToast('Warning', 'Please select at least one row.', 'warning');
      return;
    }
    this.checkLost = true; // just open the modal
  }

  handleCloseModal() {
    this.checkLost = false;
  }

  async handleConfirm() {
    this.checkLost = false; // close modal before proceeding
    try {
      await updateBidderStatus({
        bidderIds: this.selectedDealerIds,
        newStatus: 'Lost',
        projectId: this.recordId
      });

      this.showToast('Success', 'Selected rows marked as Lost.', 'success');
      await this.getBidderData();

      await notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
    } catch (error) {
      this.showToast('Error', 'Error updating status to Lost.', 'error');
      console.error(error);
    }
  }

  //Add row button handle new rows 
  addRow() {
    this.newRows = [...this.newRows, { key: this.rowCounter++, Dealer__c: '', Rep_Group_Code__c: '', AQ_Link__c: '', AQ_Link2__c: '' }];
  }

  //Remove added rows 
  removeNewRow(event) {
    const index = Number(event.target.dataset.index);
    const keyToRemove = this.newRows[index].key;
    this.newRows = this.newRows.filter(row => row.key !== keyToRemove);
  }

  //Save all button handle new rows and existing rows
  saveAll() {

    if (this.newRows.length === 0) {
      this.showToast('Info', 'No rows to save.', 'info');
      return;
    }

    // Validate required fields manually
    for (let row of this.newRows) {
      if (!row.Dealer__c || !row.Rep_Group_Code__c) {
        this.showToast('Error', 'Please fill all required fields.', 'error');
        return;
      }
    }

    const seenDealers = new Set();
    for (let row of this.newRows) {
      const dealerKey = row.Dealer__c.trim().toLowerCase();
      if (seenDealers.has(dealerKey)) {
        this.showToast('Error', `Duplicate dealer found.`, 'error');
        return;
      }
      seenDealers.add(dealerKey);
    }

    // Add Project__c to each row
    const biddersToInsert = this.newRows.map(row => ({
      Dealer__c: row.Dealer__c,
      Rep_Group_Code__c: row.Rep_Group_Code__c,
      AQ_Link__c: row.AQ_Link__c,
      AQ_Link2__c: row.AQ_Link2__c,
      Project__c: this.recordId
    }));

    insertBidders({ bidders: biddersToInsert })
      .then(() => {
        this.showToast('Success', 'Records saved successfully!', 'success');
        this.newRows = [];  // Clear input form
        this.getBidderData(); // Refresh data table
      })
      .catch(error => {
        let errorMessage =
          error?.body?.pageErrors?.[0]?.message || // Try first
          error?.body?.message ||                 // fallback
          'Unknown error';

        console.log('Error message:', errorMessage);
        this.showToast('Error', errorMessage, 'error');
        // console.error('Insert Error:', error);
      });
  }

  handleInputChange(event) {
    const index = event.target.dataset.index;
    const field = event.target.dataset.field;
    const value = event.target.value;
    // console.log('index--->' + index);
    // console.log('field--->' + field);
    // console.log('value--->' + value); 
    this.newRows = this.newRows.map((row, i) => {
      if (i === parseInt(index, 10)) {
        return { ...row, [field]: value };
      }
      return row;
    });
  }
  handleNewRecordSuccess(event) {
    this.showToast('Success', 'Record saved successfully!', 'success');
    this.newRows = []; // Clear new rows after success
    this.getBidderData(); // Refresh list
  }

  handleNewRecordError(event) {
    this.showToast('Error', 'Error saving record', 'error');
    console.error('Error saving record:', event.detail);
  }

  showToast(title, message, variant) {
    this.dispatchEvent(
      new ShowToastEvent({
        title,
        message,
        variant
      })
    );
  }
}