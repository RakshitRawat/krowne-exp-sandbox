import { LightningElement, track, wire } from 'lwc';
// import getOrderAndInvoiceRecords from '@salesforce/apex/OrderAndInvoiceListViewController.getOrderAndInvoiceRecords';
import getOrders from '@salesforce/apex/OrderAndInvoiceListViewController.getOrders';
import getInvoices from '@salesforce/apex/OrderAndInvoiceListViewController.getInvoices';

import { NavigationMixin } from 'lightning/navigation';

export default class OrderAndListView extends NavigationMixin(LightningElement) {
    selectedView = 'Open Orders';
    searchKey = '';
    @track allOrders = [];
    @track allInvoices = [];
    @track filteredRecords = [];
    @track selectedRows = [];
    @track columns = [];
    // @track rowSize = 50;
    // @track rowOffset = 0;

    lastRecordId = null;
    lastShipDate = null;

    // store cursor per page (for page jump)
    pageCursorMap = {};



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

    // Strat from here ------
    @track pagedRecords =[];
    totalRecords=0;
    pageSize = 30;
    maxPageButtons =5;
    currentPage = 1;

    get totalPages() {
        return Math.ceil(this.totalRecords / this.pageSize);
    }

    get isFirstPage() {
        return this.currentPage === 1;
    }


    get isLastPage() {
    // When NOT searching → always allow Next
    if (!this.searchKey || this.searchKey.trim() === '') {
        return false;
    }
    return this.currentPage === this.totalPages;
    }

    get pageButtons() {
    const pages = [];
    const total = this.totalPages;
    const current = this.currentPage;
    const maxVisible = 5;

    let start = Math.max(1, current - 2);
    let end = Math.min(total, current + 2);

    if (start === 1) {
        end = Math.min(total, maxVisible);
    }

    if (end === total) {
        start = Math.max(1, total - maxVisible + 1);
    }

    // First page
    if (start > 1) {
        pages.push({
            id: 'page-1',
            label: '1',
            value: 1,
            variant: current === 1 ? 'brand' : 'neutral',
            isEllipsis: false
        });

        if (start > 2) {
            pages.push({
                id: 'ellipsis-start',
                isEllipsis: true
            });
        }
    }

    // Middle pages
    for (let i = start; i <= end; i++) {
        pages.push({
            id: `page-${i}`,
            label: i.toString(),
            value: i,
            variant: i === current ? 'brand' : 'neutral',
            isEllipsis: false
        });
    }

    // Last page
    if (end < total) {
    pages.push({
        label: '…',
        isEllipsis: true
    });

    pages.push({
        id: `page-${total}`,
        label: total.toString(),
        value: total,
        variant: current === total ? 'brand' : 'neutral',
        isEllipsis: false
    });
    }

    return pages;
}




    get pageOptions() {
    let options = [];
    for (let i = 1; i <= this.totalPages; i++) {
        options.push({
            label: `Page ${i}`,
            value: i
        });
    }
    return options;
    }

    handlePageDropdown(event) {
    this.currentPage = Number(event.detail.value);
    this.updatePagedRecords();
    }


    updatePagedRecords() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        this.pagedRecords = this.filteredRecords.slice(start, end);
    }

    handlePageClick(event) {
        this.currentPage = Number(event.target.dataset.page);
        this.updatePagedRecords();
    }

    goToFirst() {
        this.currentPage = 1;
        this.updatePagedRecords();
    }

    goToLast() {
        this.currentPage = this.totalPages;
        this.updatePagedRecords();
    }

    goToPrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updatePagedRecords();
        }
    }

    goToNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.updatePagedRecords();
        }
    }
    // End here ------

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
    const eventName = event.currentTarget.dataset.id;

    // Reset pagination
    this.pageCursorMap = {};
    this.currentPage = 1;

    if (eventName === 'clear') {
        // ✅ Default back to Last 12 Months
        this.selectedFilter = '365-days';
        this.dayRange = '365';
        this.searchKey = '';
    } else {
        this.selectedFilter = eventName;
        this.dayRange = eventName.split('-')[0];
    }

    this.loadData(1);
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
        { label: 'Open Orders', value: 'Open Orders' },
        { label: 'Shipped Orders', value: 'Shipped Orders' },
        { label: 'Open and Shipped Orders ', value: 'Open and Shipped Orders ' },
        { label: 'No Ship Date Orders', value: 'No Ship Date Orders' }
    ];

    get selectViewForImage() {
            this.orderSelected = true;
            return 'standard:orders';
    }

    // Define columns for Orders
    orderColumns = [
        {
            label: 'Krowne Order#',
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
        { label: 'Order Amount', fieldName: 'GPAmount', type: 'currency', sortable: true },
        { label: 'Status', fieldName: 'Status', type: 'text', sortable: true },
        { label: 'PO Number', fieldName: 'PoNumber', type: 'text', sortable: true },
        { label: 'Project', fieldName: 'Project', type: 'text', sortable: true },
        { label: 'Est. Ship Date', fieldName: 'ShipDate', type: 'text', sortable: true }
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
    ];

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
    ];

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
       // this.loadData(); // only load if no filter was applied
        this.selectedFilter = '365-days';
        this.dayRange = 365;
        this.currentPage = 1;
        this.pageCursorMap = {};

        this.loadData(1);
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


    async loadData(page = 1) {
    this.isLoading = true;
    this.setColumns();

    const isSearchActive = this.searchKey && this.searchKey.trim() !== '';

    // Cursor only used in NON-search mode
    const cursor = !isSearchActive
        ? this.pageCursorMap[page - 1] || {}
        : {};

    console.log('cursor---->',cursor);
    try {
        console.log('PageSize--->'+ this.pageSize);
        const result = await getOrders({
            searchKey: this.searchKey,
            fetchOnHoldOrders: this.fetchOnHoldOrders,
            dayRange: this.dayRange,
            limitSize: this.pageSize,
            orderFilterName: this.selectedView,
            lastShipDate: !isSearchActive ? cursor.lastShipDate || null : null,
            lastRecordId: !isSearchActive ? cursor.lastRecordId || null : null
        });

        this.allOrders = result;

        // Save cursor ONLY when not searching
        if (!isSearchActive && result.length > 0) {
            const last = result[result.length - 1];
            this.pageCursorMap[page] = {
                lastShipDate: last.ShipDate ? new Date(last.ShipDate) : null,
                lastRecordId: last.Id
            };

        }

        this.currentPage = page;
        this.applyFilters();

    } catch (error) {
        console.error('Error loading orders:', error);
    } finally {
        this.isLoading = false;
    }
}


    handlePageClick(event) {
    this.currentPage = Number(event.target.dataset.page);
    this.updatePagedRecords();
    }


    goToFirst() {
    this.currentPage = 1;
    this.updatePagedRecords();
    }

    goToPrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updatePagedRecords();
        }
    }

    goToNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.updatePagedRecords();
        }
    }

    goToLast() {
        this.currentPage = this.totalPages;
        this.updatePagedRecords();
    }






    loadMoreData(event) {

        if (!this.hasMoreData) {
            this.offset = 0;
            event.target.isLoading = false;
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
        this.columns = this.orderColumns;
    }

    handleViewChange(event) {
    this.selectedView = event.detail.value;
    this.fetchOnHoldOrders = false;
    this.pageCursorMap = {};
    this.loadData(1);
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

    // Reset pagination state
    this.pageCursorMap = {};
    this.currentPage = 1;

    this.loadData(1);
    }




    handleRowSelection(event) {
        this.selectedRows = event.detail.selectedRows;
    }

    handleRefresh() {
        this.applyFilters();
    }

    /*applyFilters(isLoadMore = false) {
        console.log('applyfilters===>');
        let records;

        records = [...this.allOrders];
        this.columns = this.orderColumns;

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

            base.AccountLink = item.AccountId ? '/' + item.AccountId : null;
            base.OrderLink = item.OrderId ? '/' + item.OrderId : null;

            return base;
        });

        console.log('searched===>', (searched));
        if (isLoadMore) {
            this.filteredRecords = [...this.filteredRecords, ...mappedRecords];
        } else {
            this.filteredRecords = mappedRecords;

        }
    }*/

    applyFilters() {
    let records = [...this.allOrders];

    const isSearchActive = this.searchKey && this.searchKey.trim() !== '';

    if (isSearchActive) {
        const searchText = this.searchKey.toLowerCase();
        records = records.filter(row =>
            Object.values(row).some(value =>
                value && value.toString().toLowerCase().includes(searchText)
            )
        );
    }

    this.filteredRecords = records.map((item, index) => ({
        ...item,
        RowNumber: index + 1,
        Link: '/' + item.Id,
        AccountLink: item.AccountId ? '/' + item.AccountId : null,
        OrderLink: item.OrderId ? '/' + item.OrderId : null
    }));

    /* ✅ FIX: lastRecordId must come from client data */
    this.lastRecordId =
        this.filteredRecords.length > 0
            ? this.filteredRecords[this.filteredRecords.length - 1].Id
            : null;

    this.totalRecords = this.filteredRecords.length;
    this.updatePagedRecords();
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