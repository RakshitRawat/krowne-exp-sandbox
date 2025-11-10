import { LightningElement, track, wire } from 'lwc';
// import getOrderAndInvoiceRecords from '@salesforce/apex/OrderAndInvoiceListViewController.getOrderAndInvoiceRecords';
import getOrders from '@salesforce/apex/OrderAndInvoiceListViewController.getOrders';
import getInvoices from '@salesforce/apex/OrderAndInvoiceListViewController.getInvoices';

import { NavigationMixin } from 'lightning/navigation';

export default class OrderAndListView extends NavigationMixin(LightningElement) {
    selectedView = 'Orders';
    searchKey = '';
    @track allOrders = [];
    @track allInvoices = [];
    @track filteredRecords = [];
    @track selectedRows = [];
    @track columns = [];
    @track rowSize = 50;
    @track rowOffset = 0;


    sortedBy;
    sortDirection;
    orderSearch = '';
    invoiceSearch = '';
    fetchOnHoldOrders = false;
    debounceTimeout;
    dayRange = null;
    hasFilterApplied = false;
    suppressHide = false;
    clearFilterMenu = false;
    hasMoreData = true;

    handleDropdownMouseEnter() {
        this.isHoveringDropdown = true;
    }

    handleDropdownMouseLeave() {
        this.isHoveringDropdown = false;
    }

    @track selectedFilter = '';

    baseFilters = [
        { id: '30-days', label: 'Last 30 Days' },
        { id: '60-days', label: 'Last 60 Days' },
        { id: '90-days', label: 'Last 90 Days' },
        { id: '365-days', label: 'Last 12 months' },
        { id: 'clear', label: 'Clear Filters' }
    ];

    get filters() {
        return this.baseFilters.map(filter => {
            return {
                ...filter,
                className: this.selectedFilter === filter.id ? 'menu-link selected' : 'menu-link'
            };
        });
    }


    handleFilter(event) {
        this.rowOffset = 0;
        let eventName = event.currentTarget.dataset.id;
        let element = this.template.querySelector(`[data-id="${eventName}"]`);
        let icon = this.template.querySelector(`[data-id="filterButton"]`);
        if (element) {
            element.style.backgroundColor = 'blue';
            element.style.color = 'white'; // Optional: for contrast
        }
        if (eventName.includes('-')) {
            icon.classList.add('custom-filter');
            this.selectedFilter = eventName;
            this.dayRange = eventName.split('-')[0];
            this.showFilterMenu = false;
            this.isHoveringDropdown = false;
            this.clearFilterMenu = true;
            this.loadData();

        }
        else {
            icon.classList.remove('custom-filter');
            this.selectedFilter = '';
            this.dayRange = null;
            this.showFilterMenu = false;
            this.isHoveringDropdown = false;  // <-- Add this
            this.loadData();
        }

    }


    orderSelected = true;
    isLoading = true;

    responsiveClass = '';
    responsivePanel = 'display: flex;flex-direction: column;align-items: end;gap: 10px;';

    @track showFilterMenu = false;

    toggleFilterMenu() {
        this.suppressHide = true;
        this.showFilterMenu = true;

        // Delay hiding suppression reset so dropdown gets a chance to register clicks
        setTimeout(() => {
            this.suppressHide = false;
        }, 250); // Can increase to 200 if needed
    }

    viewOptions = [
        { label: 'All Orders', value: 'Orders' },
        { label: 'All Invoices', value: 'Invoices' },
        { label: 'On Hold Orders', value: 'On Hold Orders' }
    ];

    get selectViewForImage() {
        if (this.selectedView === 'Orders') {
            this.orderSelected = true;
            return 'standard:orders';
        }
        else if (this.selectedView === 'Invoices') {
            this.orderSelected = false;
            return 'custom:custom13';
        }
        else if (this.selectedView === 'On Hold Orders') {
            this.orderSelected = true;
            return 'standard:orders';
        }
    }

    // Define columns for Orders
    orderColumns = [
        {
            label: 'Order Document Number',
            fieldName: 'Link',
            type: 'url',
            sortable: true,
            typeAttributes: {
                label: { fieldName: 'Name' },
                target: '_blank'
            }
        },
        {
            label: 'Account Name',
            fieldName: 'AccountLink',
            type: 'url',
            sortable: true,
            typeAttributes: {
                label: { fieldName: 'AccountName' },
                target: '_blank'
            }
        },
        { label: 'Order Amount', fieldName: 'GPAmount', type: 'text', sortable: true },
        { label: 'Status', fieldName: 'Status', type: 'text', sortable: true },
        { label: 'PO Number', fieldName: 'PoNumber', type: 'text', sortable: true },
        { label: 'Project', fieldName: 'Project', type: 'text', sortable: true },
        { label: 'Ship Date', fieldName: 'ShipDate', type: 'text', sortable: true }
        // { label: 'Effective Date', fieldName: 'EffectiveDate', type: 'text', sortable: true },
        // { label: 'Owner', fieldName: 'OwnerName', type: 'text', sortable: true },
        // { label: 'Created Date', fieldName: 'CreatedDate', type: 'text', sortable: true },
        //{ label: 'Ship Date', fieldName: 'Customer_PO_Number__c', type: 'text', sortable: true },
        // { label: 'Last Modified', fieldName: 'LastModifiedDate', type: 'text', sortable: true }
    ];


    onHoldOrderColumns = [
        {
            label: 'Order Document Number',
            fieldName: 'Link',
            type: 'url',
            sortable: true,
            typeAttributes: {
                label: { fieldName: 'Name' },
                target: '_blank'
            }
        },
        {
            fieldName: '',
            label: 'Needs Attention',
            cellAttributes: { iconName: 'utility:warning', class: 'slds-text-color_success' }
        },
        {
            label: 'Account Name',
            fieldName: 'AccountLink',
            type: 'url',
            sortable: true,
            typeAttributes: {
                label: { fieldName: 'AccountName' },
                target: '_blank'
            }
        },
        { label: 'Order Amount', fieldName: 'GPAmount', type: 'text', sortable: true },
        { label: 'Status', fieldName: 'Status', type: 'text', sortable: true },
        { label: 'PO Number', fieldName: 'PoNumber', type: 'text', sortable: true },
        { label: 'Project', fieldName: 'Project', type: 'text', sortable: true },
        // { label: 'Effective Date', fieldName: 'EffectiveDate', type: 'text', sortable: true },
        // { label: 'Owner', fieldName: 'OwnerName', type: 'text', sortable: true },
        // { label: 'Created Date', fieldName: 'CreatedDate', type: 'text', sortable: true },
        //{ label: 'Ship Date', fieldName: 'Customer_PO_Number__c', type: 'text', sortable: true },
        // { label: 'Last Modified', fieldName: 'LastModifiedDate', type: 'text', sortable: true }
    ];
    //     {
    //         label: 'Order Document Number',
    //         fieldName: 'Link',
    //         type: 'url',
    //         sortable: true,
    //         typeAttributes: {
    //             label: { fieldName: 'Name' },
    //             target: '_blank'
    //         }
    //     },
    //     {
    //         fieldName: '',
    //         label: 'Needs Attention',
    //         cellAttributes: { iconName: 'utility:warning', class: 'slds-text-color_success' }
    //     },
    //     {
    //         label: 'Account Name',
    //         fieldName: 'AccountLink',
    //         type: 'url',
    //         sortable: true,
    //         typeAttributes: {
    //             label: { fieldName: 'AccountName' },
    //             target: '_blank'
    //         }
    //     },
    //     { label: 'Status', fieldName: 'Status', type: 'text', sortable: true },
    //     { label: 'Effective Date', fieldName: 'EffectiveDate', type: 'text', sortable: true },
    //     { label: 'Owner', fieldName: 'OwnerName', type: 'text', sortable: true },
    //     // { label: 'Created Date', fieldName: 'CreatedDate', type: 'text', sortable: true },
    //     //{ label: 'Ship Date', fieldName: 'Customer_PO_Number__c', type: 'text', sortable: true },
    //     { label: 'Last Modified', fieldName: 'LastModifiedDate', type: 'text', sortable: true }
    // ];



    // Define columns for Invoices
    invoiceColumns = [
        {
            label: 'Invoice Number',
            fieldName: 'Link',
            type: 'url',
            typeAttributes: {
                label: { fieldName: 'Name' },
                target: '_blank'
            },
            sortable: true
        },
        {
            label: 'Dealer Name',
            fieldName: 'AccountLink',
            type: 'url',
            typeAttributes: {
                label: { fieldName: 'AccountName' },
                target: '_blank'
            },
            sortable: true
        },
        {
            label: 'Order Number',
            fieldName: 'OrderLink',
            type: 'url',
            typeAttributes: {
                label: { fieldName: 'OrderName' },
                target: '_blank'
            },
            sortable: true
        },
        {
            label: 'PO Number',
            fieldName: 'PONumber',
            
            sortable: true
        },
        // { label: 'Created Date', fieldName: 'CreatedDate', type: 'text', sortable: true }
    ];

    // get isSmallScreen() {
    //     if (window.innerWidth < 590) {
    //         this.responsiveClass = 'display: flex;flex-direction: column;align-items: start;gap: 20px;';
    //         this.responsivePanel += 'margin:auto;';
    //     }
    //     return window.innerWidth < 590;
    // }
    setResponsiveStyles() {
        this.isSmallScreen = window.innerWidth < 890;

        if (this.isSmallScreen) {
            this.responsiveClass = 'display: flex;flex-direction: column;align-items: start;gap: 20px;';
            this.responsivePanel = 'margin:auto;';
        } else {
            this.responsiveClass = 'display: flex;flex-direction: row;align-items: center;gap: 20px;';
            this.responsivePanel = '';
        }
    }

    connectedCallback() {
        this.setResponsiveStyles();
        this._handleClickOutside = this.handleClickOutside.bind(this);
        document.addEventListener('mousedown', this._handleClickOutside);
        this.loadData(); // only load if no filter was applied
    }

    disconnectedCallback() {
        document.removeEventListener('mousedown', this._handleClickOutside);
    }


    handleClickOutside(event) {
        if (this.suppressHide || this.isHoveringDropdown) return;

        const filterButton = this.template.querySelector('[data-id="filterButton"]');
        const dropdown = this.template.querySelector('.slds-dropdown');

        if (
            filterButton &&
            !filterButton.contains(event.target) &&
            dropdown &&
            !dropdown.contains(event.target)
        ) {
            this.showFilterMenu = false;
        }
    }



    // @wire(getOrders, { searchKey: '$orderSearch', fetchOnHoldOrders: '$fetchOnHoldOrders' })
    // wiredData({ error, data }) {
    //     if (data) {
    //         this.allOrders = data || [];
    //         // this.allInvoices = data || [];
    //         this.setColumns();
    //         this.applyFilters();
    //         this.isLoading = false;
    //     } else if (error) {
    //     }
    // }

    // @wire(getInvoices, { searchKey: '$invoiceSearch' })
    // wiredInvoiceData({ error, data }) {
    //     if (data) {
    //         this.allInvoices = data || [];
    //         this.setColumns();
    //         this.applyFilters();
    //         this.isLoading = false;
    //     } else if (error) {
    //     }
    // }

    async loadData(isLoadMore = false) {
        //this.isLoading = true;
        this.setColumns();
        if (this.selectedView === 'Orders' || this.selectedView === 'On Hold Orders') {
            await getOrders({ searchKey: this.searchKey, fetchOnHoldOrders: this.fetchOnHoldOrders, dayRange: this.dayRange, limitSize: this.rowSize, offset: this.rowOffset })
                .then((result) => {

                    if (isLoadMore) {
                        // Append for load more
                        this.allOrders = [...this.allOrders, ...result];
                        //this.allInvoices = [...this.allInvoices, ...result];
                        // console.log('result--->', this.allOrders);
                    } else {
                        // console.log('resultLoadData--->', result);
                        this.allOrders = result;
                        //this.allInvoices = result;
                    }

                    if (result.length < this.rowSize && this.searchKey != '') {
                        this.hasMoreData = false;
                    } else {
                        this.hasMoreData = true;
                    }
                    this.applyFilters();
                })
                .catch((error) => {
                    console.error('Error while loading orders:', error);
                })

                .finally(() => {
                    this.isLoading = false;
                });

        } else if (this.selectedView === 'Invoices') {
            await getInvoices({ searchKey: this.searchKey, dayRange: this.dayRange, limitSize: this.rowSize, offset: this.rowOffset })
                .then((result) => {
                    if (isLoadMore) {
                        this.allInvoices = [...this.allInvoices, ...result];
                    } else {
                        this.allInvoices = result;
                    }

                    if (result.length < this.rowSize && this.searchKey !== '') {
                        this.hasMoreData = false;
                    } else {
                        this.hasMoreData = true;
                    }

                    this.applyFilters();
                })
                .catch((error) => {
                    console.error('Error while loading invoices:', error);
                })
                .finally(() => {
                    this.isLoading = false;
                });

        }
    }


    loadMoreData(event) {
        // console.log('hasMoreData--->', this.hasMoreData);

        if (!this.hasMoreData) {
            // console.log('No more data to load');
            this.offset = 0; 
            event.target.isLoading = false;
            //this.applyFilters();
            return;
        }

        event.target.isLoading = true;
        if (this.searchKey === null || this.searchKey === '') {
            this.rowOffset += this.rowSize;
        }

        try {
            if (this.searchKey === null || this.searchKey === '') {
                this.loadData(true); // make sure loadData handles .catch inside too
            }

        } catch (error) {
            console.error('Error in loadMoreData:', error);
        } finally {
            event.target.isLoading = false;
        }
    }






    setColumns() {
        if (this.selectedView === 'Orders') {
            this.columns = this.orderColumns;
        }
        else if (this.selectedView === 'Invoices') {
            this.columns = this.invoiceColumns;
        }
        else {

            this.columns = this.onHoldOrderColumns;
        }
    }

    handleViewChange(event) {
        this.rowOffset = 0;
        this.isLoading = true;
        this.selectedView = event.detail.value;

        if (this.selectedView === 'On Hold Orders') {
            this.fetchOnHoldOrders = true;
        }
        else {
            this.fetchOnHoldOrders = false;
        }
        this.loadData();
        this.setColumns();
        // this.applyFilters();
    }

    navigateToRecord(event) {
        let objectName = event.currentTarget.dataset.name == 'Order' ? 'Order' : 'Invoice__c';
        const orderId = event.currentTarget.dataset.id;

        this[NavigationMixin.GenerateUrl]({
            type: 'standard__recordPage',
            attributes: {
                recordId: orderId,
                objectApiName: objectName,
                actionName: 'view'
            }
        }).then(url => {
            window.open(url, '_blank'); 
        });
    }



    handleSearchChange(event) {
        this.searchKey = event.target.value.toLowerCase();
        this.rowOffset = 0;
        clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(() => {
            // console.log('debouncetime');
            this.loadData();
        }, 300);
    }


    handleRowSelection(event) {
        this.selectedRows = event.detail.selectedRows;
    }

    handleRefresh() {
        // console.log('refresh');
        this.applyFilters();
    }

    // applyFilters() {
    //     let records = this.selectedView === 'Orders' ? [...this.allOrders] : [...this.allInvoices];

    //     const searched = records.filter(row => {
    //         return Object.values(row).some(value =>
    //             value && value.toLowerCase().includes(this.searchKey)
    //         );
    //     });

    //     this.filteredRecords = searched.map((item, index) => ({
    //         ...item,
    //         RowNumber: index + 1,
    //         Link: '/' + item.Id,
    //         AccountLink: item.AccountId ? '/' + item.AccountId : null,
    //         OrderLink: item.OrderId ? '/' + item.OrderId : null
    //     }));

    //     this.isLoading = false;
    // }

    applyFilters(isLoadMore = false) {
        console.log('applyfilters===>');
        let records;

        if (this.selectedView === 'Orders') {
            records = [...this.allOrders];
            this.columns = this.orderColumns;
            //console.log('Records====>', JSON.stringify(records));
        } else if (this.selectedView === 'Invoices') {
            records = [...this.allInvoices];
            this.columns = this.invoiceColumns;
        } else if (this.selectedView === 'On Hold Orders') {
            records = [...this.allOrders];
            this.columns = this.onHoldOrderColumns;
        } else {
            records = [];
            this.columns = [];
        }

        const searched = records.filter(row => {
            return Object.values(row).some(value =>
                value && value.toLowerCase().includes(this.searchKey)
            );
        });

        const mappedRecords = searched.map((item, index) => {
            let base = {
                ...item,
                RowNumber: index + 1,
                Link: '/' + item.Id
                //Link: item.Name != null ? item.Name : null

            };

            if (this.selectedView === 'Orders' || this.selectedView === 'On Hold Orders') {
                base.AccountLink = item.AccountId ? '/' + item.AccountId : null;
                base.OrderLink = item.OrderId ? '/' + item.OrderId : null;
            }

            if (this.selectedView === 'Invoices') {
                console.log('Invoices');
                base.AccountLink = item.AccountId ? '/' + item.AccountId : null;
                base.InvoiceLink = item.InvoiceId ? '/' + item.InvoiceId : null;
                base.OrderLink = item.OrderId ? '/' + item.OrderId : null;
            }

            return base;
        });

        console.log('searched===>', (searched));
        if (isLoadMore) {
            this.filteredRecords = [...this.filteredRecords, ...mappedRecords];
        } else {
            this.filteredRecords = mappedRecords;
            
        }
    }



    handleNewRecord(event) {
        let objName = event.target.dataset.name;
        let objApiName = objName === 'order' ? 'Order' : 'Invoice__c';

        if (objApiName !== '') {
            this[NavigationMixin.Navigate]({
                type: 'standard__objectPage',
                attributes: {
                    objectApiName: objApiName,
                    actionName: 'new'
                }
            });
        }
    }
    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;
        this.sortedBy = fieldName;
        this.sortDirection = sortDirection;

        let sortedData = [...this.filteredRecords];

        sortedData.sort((a, b) => {
            let valA = a[fieldName] ? a[fieldName].toString().toLowerCase() : '';
            let valB = b[fieldName] ? b[fieldName].toString().toLowerCase() : '';

            return sortDirection === 'asc'
                ? valA > valB ? 1 : valA < valB ? -1 : 0
                : valA < valB ? 1 : valA > valB ? -1 : 0;
        });

        this.filteredRecords = sortedData;
    }

}