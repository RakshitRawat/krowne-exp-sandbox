import { LightningElement, api, track, wire } from 'lwc';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { CurrentPageReference } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import COMMISSION_LINE_OBJECT from '@salesforce/schema/Commission_Line__c';
import REP_GROUP_CODE_FIELD from '@salesforce/schema/Commission_Line__c.Rep_Group_Code__c';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getCommissionLines from '@salesforce/apex/CommissionController.getCommissionLines';
import saveCommissionLines from '@salesforce/apex/CommissionController.saveCommissionLines';

export default class CreateAndViewMultipleCommissions extends LightningElement {
    @api recordId;
    @track rows = [];
    @track uploadedFilesMap = {};
    repGroupOptions = [];
    acceptedFormats = ['.xlsx', '.xls', '.csv'];
    commissionLinesResult; // store wired result for refresh
    wiredData;
    @track commissionLineInputs = [];

    loaded = false;

    columns = [
        { label: 'Rep Group Code', fieldName: 'repGroupCode', type: 'text' },
        { label: 'File Name', fieldName: 'fileName', type: 'text' },
        { label: 'Created Date', fieldName: 'createdDate', type: 'date' }
    ];

    @wire(CurrentPageReference)
    getPageRef(pageRef) {
        if (pageRef) {
            this.recordId =
                pageRef.state?.recordId ||    // Standard record pages
                pageRef.attributes?.recordId; // Fallback for some contexts

            console.log('Parent Record ID:', this.recordId);
        }
    }


    @wire(getCommissionLines, { commissionId: '$recordId' })
    wiredCommissionLines(result) {
        console.log('in comiisos', result);
        this.wiredData = result;
        this.commissionLinesResult = result.data;
        this.loaded = true;
        if (result.error) {
            console.error('Error fetching commission lines', result.error);
        }
    }

    @wire(getObjectInfo, { objectApiName: COMMISSION_LINE_OBJECT })
    objectInfo;

    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: REP_GROUP_CODE_FIELD
    })
    wiredPicklist({ error, data }) {
        if (data) {
            this.repGroupOptions = data.values.map(opt => ({
                label: opt.label,
                value: opt.value
            }));
            console.log('this.repGroupOptions', this.repGroupOptions);
        } else if (error) {
            console.error('Error loading picklist values', error);
        }
    }

    connectedCallback() {
        this.addRow();
    }

    addRow() {
        this.commissionLineInputs = [
            ...this.commissionLineInputs,
            { key: Date.now(), repGroupCode: '', fileId: null }
        ];
    }

    removeRow(event) {
        const index = event.target.dataset.index;
        this.commissionLineInputs.splice(index, 1);
        this.commissionLineInputs = [...this.commissionLineInputs];
    }

    handleInputChange(event) {
        const index = event.target.dataset.index;
        const field = event.target.name;
        this.commissionLineInputs[index][field] = event.target.value;
        event.target.setCustomValidity('');
        event.target.reportValidity();
    }

    handleFileChange(event) {
        const index = event.target.dataset.index;
        const file = event.target.files[0];
        if (file) {
            console.log('File', file);
            const reader = new FileReader();
            reader.onload = () => {
                // Remove the prefix like "data:<mime>;base64," to get just base64 string
                const base64 = reader.result.split(',')[1];
                this.commissionLineInputs[index].fileBase64 = base64;
                this.commissionLineInputs[index].fileName = file.name;
                this.commissionLineInputs[index].fileError = null;
                this.commissionLineInputs = [...this.commissionLineInputs];
            };
            reader.readAsDataURL(file);
        }
    }
    openFileDialog(event) {
        const index = event.target.dataset.index;
        const input = this.template.querySelector(`input[data-index="${index}"]`);
        if (input) {
            input.click();
        }
    }





    saveCommissionLines() {
        if (this.validateInputs()) {

            const payload = this.commissionLineInputs.map(row => ({
                repGroupCode: row.repGroupCode,
                fileName: row.fileName,
                fileBase64: row.fileBase64 // send base64 content here
            }));
            console.log('payload', payload);

            saveCommissionLines({ commissionId: this.recordId, commissionData: payload })
                .then(() => {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Success',
                            message: 'Commission lines created successfully',
                            variant: 'success'
                        })
                    );
                    return refreshApex(this.wiredData);

                })
                .then(() => {
                    this.commissionLineInputs = [];
                    this.addRow();
                    this.template.querySelectorAll('input[type="file"]').forEach(input => {
                        input.value = null;
                    });
                })
                .catch(error => {
                    console.error('Error saving commissions', error);
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Error',
                            message: 'Failed to create commission lines',
                            variant: 'error'
                        })
                    );
                });
        }
    }
    validateInputs() {
        console.log('this.commissionLineInputs', this.commissionLineInputs);

        let allValid = true;

        this.commissionLineInputs.forEach((item, index) => {
            console.log('item', item);
            console.log('item', item.fileName);
            // Validate Rep Group Code
            const combobox = this.template.querySelector(`lightning-combobox[data-index="${index}"]`);
            if (!item.repGroupCode || !combobox) {
                allValid = false;
                if (combobox) {
                    combobox.setCustomValidity('Please select Rep Group Code');
                    combobox.reportValidity();
                }
            } else {
                combobox.setCustomValidity('');
                combobox.reportValidity();
            }

            // Validate File Upload
            if (item.fileName === undefined) {
                console.log('here i am');
                allValid = false;
                this.commissionLineInputs[index].fileError = 'Please upload a file';
            } else {
                this.commissionLineInputs[index].fileError = null;
            }
        });

        // Refresh reactive property to update errors in UI
        this.commissionLineInputs = [...this.commissionLineInputs];

        return allValid;
    }


}