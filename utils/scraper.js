const axios = require("axios").default;
const cheerio = require("cheerio");

module.exports = class Scraper {

    constructor({ name, autoUpdates, onlyNew, allDealerships, model, minPrice, maxPrice, minYear, maxYear, customerName, customerPhone, notes }) {
        this.name = name;
        this.autoUpdates = autoUpdates;
        this.onlyNew = onlyNew;
        this.allDealerships = allDealerships;
        this.model = model.charAt(0).toUpperCase() + model.substring(1).toLowerCase();
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
        this.minYear = minYear;
        this.maxYear = maxYear;
        this.customerName = customerName;
        this.customerPhone = customerPhone;
        this.notes = notes;

        this.totalResults = [];

    }

    async getResults() {
        const scrapedResults = await this.loadWebPage();

        return this.totalResults;
    }

    parseWebPage(webpage) {
        const $ = cheerio.load(webpage);

        const vehicles = [];
        $("div[id*='srpVehicle']").each((i, el) => {
            if (Object.values($(el).data()).length > 0) // Confirms object is not empty
                vehicles.push($(el).data());
        });

        const miles = [];
        $(".mileageDisplay").each((i, el) => {
            if (i % 2 == 0 || i == 0) {
                const mileage = $(el).text().substring(8).trim();
                miles.push(mileage);
            }
        });
        
        const dealers = [];
        $(".dealershipDisplay").each((i, el) => {
            if (i % 2 == 0 || i == 0) {
                const dealer = $(el).text().substring(11).trim();
                dealers.push(dealer);
            }
        });
        
        const links = [];
        $(".vehicleDetailsLink").each((i, el) => {
            const link = $(el).attr("href");
            links.push(link);
        });
        
        const carfaxLinks = [];
        $(".carhistory").each((i, el) => {
            const carfax = $(el).children("a").first().attr("href");
            carfaxLinks.push(carfax);
        });

        const imageLinks = [];
        $(".vehicleImgColumn .vehiclePhoto img.vehicleImg").each((i, el) => {
          const imageLink = "https://www.liatoyotaofcolonie.com" + $(el).prop("src");
          imageLinks.push(imageLink);
        })

        let resultsList = [];

        resultsList = vehicles.map((el, i) => {
            return {
                stock: el.stocknum,
                make: el.make,
                model: el.model,
                year: el.year,
                trim: el.trim,
                extColor: el.extcolor,
                price: el.price,
                vin: el.vin,
                intColor: el.intcolor,
                transmission: el.trans,
                engine: el.engine,
                miles: miles[i],
                dealer: dealers[i],
                link: links[i],
                carfaxLink: carfaxLinks[i],
                imageLink: imageLinks[i]
            };
        });

        resultsList = resultsList.filter(item => {
            return item.year >= this.minYear && item.year <= this.maxYear;
        });

        resultsList = resultsList.filter(item => {
            return item.price >= this.minPrice && item.price <= this.maxPrice;
        });

        return resultsList;
    }

    async loadWebPage() {

        let continueGettingWebpages = true;
        let counter = 1;
        while (continueGettingWebpages) {

            let siteUrl = this.allDealerships
                ? `https://www.liatoyotaofcolonie.com/searchused.aspx?Make=Toyota&Model=${this.model}&pt=${counter}`
                : `https://www.liatoyotaofcolonie.com/searchused.aspx?Dealership=Lia%20Toyota%20of%20Colonie&Make=Toyota&Model=${this.model}&pt=${counter}`;
            
            try {
                const response = await axios.get(siteUrl);
                console.log(siteUrl);
                counter++;
                if (response.status >= 200 && response.status <= 299) {

                    this.totalResults = this.parseWebPage(response.data);
                }

            } catch (error) {
                console.log(error.response.status);
                continueGettingWebpages = false;
            }
            
            // axios.get(siteUrl).then(response => {
            //     console.log("WHAT")
            //         console.log(response.status);
            //         counter++;
            //     }).catch(error => {
            //         continueGettingWebpages = false;
            //     });            
        }

        return this.totalResults;

        // try {
        //     axios.get("https://www.liatoyotaofcolonie.com/searchused.aspx?Make=Toyota&Model=Corolla&pt=1")
        //     .then(response => {

        //         console.log(response.status)
        //     }).catch(error => {
        //         if (error.response) {
        //             // Request was made and the server responded with a status code not in 200s range
        //             console.log(error.response.status)
        //         } else if (error.request) {
        //             // Request was made but no response was received
        //             console.log(error.request);
        //         } else {
        //             // Something else
        //         }
        //     })
            
        // } catch (error) {
        //     console.log(error);
        // }
    }


}