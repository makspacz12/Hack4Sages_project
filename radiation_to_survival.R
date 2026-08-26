library(tidyverse)

#loading the data from Mileikowsky et al. (2000) https://doi.org/10.1006/icar.1999.6317
dose_rates <- c(19.4, 22.2, 22.6, 22.8, 23.1, 23.8, 24.6, 24.9, 24.6, 23.9, 21.3, 18.3, 15.3, 12.7, 10.5,
                8.7, 5.9, 4.0, 1.8, 0.8, 0.3, 0.13, 0.06)
kill_freq_per_year_bs <- c(2.1, 3.9, 3.9, 3.8, 3.8, 3.8, 3.8, 4.4, 4.5, 4.5, 4.4, 4.0, 3.6, 3.2, 2.8, 2.4, 1.8, 1.3, 0.62, 0.29, 0.13, 0.05, 0.02)
kill_freq_per_year_bs_pol <- c(5.2, 9.7, 9.7, 9.6, 9.6, 9.8, 9.9, 11, 11, 12, 11, 10, 9.2, 8.1, 7.0, 6.1, 4.4, 3.1, 1.5, 0.7, 0.31, 0.13, 0.06)
kill_freq_per_year_dr <- c(4.9, 11, 10, 10, 10, 11, 11, 13, 14, 14, 14, 13, 12, 11, 9.2, 8, 5.9, 4.3, 2.1, 0.98, 0.44, 0.19, 0.08)
kill_freq_per_year_hs <- c(3.3, 8.5, 8.4, 8.3, 8.3, 8.8, 8.9, 11, 12, 13, 13, 12, 11, 9.8, 8.7, 7.6, 5.6, 4.1, 2, 0.94, 0.42, 0.18, 0.08)

#data arangement
radiation_susceptibility_data <- data.frame(dose_rates, kill_freq_per_year_bs, kill_freq_per_year_bs_pol, kill_freq_per_year_dr, kill_freq_per_year_hs)
radiation_susceptibility_data <- radiation_susceptibility_data %>% arrange(dose_rates)
radiation_susceptibility_data_longer <- pivot_longer(radiation_susceptibility_data,
                        cols = -dose_rates,          
                        names_to = "group", 
                        values_to = "kill_frequency")   

#ploting the data and regression lines
ggplot(radiation_susceptibility_data_longer, aes(x = dose_rates, y = kill_frequency, color = group)) + 
  geom_point() + 
  geom_smooth(method = "lm", se = FALSE) +
  xlab("Radiation dose recieved [Gy]") +
  ylab("Kill frequency of the cells per year") +
  ggtitle("Linear regression for estimation of radiation susceptibility coefficient")

#coefficent extraction for linear regression
lm_bs <- lm(kill_freq_per_year_bs ~ dose_rates, data = radiation_susceptibility_data)
lm_bs_pol <- lm(kill_freq_per_year_bs_pol ~ dose_rates, data = radiation_susceptibility_data)
lm_dr <- lm(kill_freq_per_year_dr ~ dose_rates, data = radiation_susceptibility_data)
lm_hs <- lm(kill_freq_per_year_hs ~ dose_rates, data = radiation_susceptibility_data)

